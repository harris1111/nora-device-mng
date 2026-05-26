#!/usr/bin/env bash
#
# nora-device-mng — S3 Backup & Restore Script
#
# Usage:
#   ./scripts/backup.sh backup              Full backup (project + database) to S3
#   ./scripts/backup.sh backup-project      Only project directory to S3
#   ./scripts/backup.sh backup-db           Only database dump to S3
#   ./scripts/backup.sh restore <date>      Restore everything from S3 backup on <date>
#   ./scripts/backup.sh list                List available backups on S3
#
# Dependencies (auto-installed if missing via apt/dnf/yum/brew/apk):
#   - awscli, postgresql-client, tar, gzip
#
# All S3 credentials are read from the project .env file.
# Run from the project root directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# ─── Helpers ─────────────────────────────────────────────────────────────────

log()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err()   { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2; }

die() {
    err "$*"
    exit 1
}

load_env() {
    if [ ! -f "$ENV_FILE" ]; then
        die ".env file not found at $ENV_FILE"
    fi
    # Export only the S3 and DB vars we need (strip quotes, handle spaces)
    set -a
    # shellcheck source=/dev/null
    source <(sed -n 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)=\(.*\)/\1=\2/p' "$ENV_FILE")
    set +a
}

s3_args() {
    # Build common S3 CLI arguments from env
    echo "--endpoint-url=${S3_ENDPOINT} --region=${S3_REGION:-ap-southeast-1}"
}

s3_cmd() {
    AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}" \
    AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY}" \
    aws $(s3_args) "$@"
}

# Detect the system package manager and install the given packages.
# Uses sudo if not running as root.
install_pkgs() {
    local pkgs=("$@")
    if [ ${#pkgs[@]} -eq 0 ]; then
        return 0
    fi

    local pkg_mgr=""
    local install_cmd=""

    if command -v apt-get >/dev/null 2>&1; then
        pkg_mgr="apt"
        install_cmd="apt-get update -qq && apt-get install -y -qq ${pkgs[*]}"
    elif command -v dnf >/dev/null 2>&1; then
        pkg_mgr="dnf"
        install_cmd="dnf install -y ${pkgs[*]}"
    elif command -v yum >/dev/null 2>&1; then
        pkg_mgr="yum"
        install_cmd="yum install -y ${pkgs[*]}"
    elif command -v brew >/dev/null 2>&1; then
        pkg_mgr="brew"
        install_cmd="brew install ${pkgs[*]}"
    elif command -v apk >/dev/null 2>&1; then
        pkg_mgr="apk"
        install_cmd="apk add --no-cache ${pkgs[*]}"
    else
        die "No supported package manager found (apt, dnf, yum, brew, apk). Install manually: ${pkgs[*]}"
    fi

    log "Installing via ${pkg_mgr}: ${pkgs[*]}"
    if [ "$(id -u)" -eq 0 ]; then
        bash -c "$install_cmd"
    elif command -v sudo >/dev/null 2>&1; then
        sudo bash -c "$install_cmd"
    else
        die "Need root to install packages but sudo is not available. Run as root or install manually: ${pkgs[*]}"
    fi
}

check_deps() {
    local pkg_mgr=""
    local missing_pkgs=()
    local missing_pips=()

    # Determine package manager for later use
    if command -v apt-get >/dev/null 2>&1; then pkg_mgr="apt"; fi
    if command -v dnf >/dev/null 2>&1;    then pkg_mgr="dnf"; fi
    if command -v yum >/dev/null 2>&1;    then pkg_mgr="yum"; fi
    if command -v brew >/dev/null 2>&1;   then pkg_mgr="brew"; fi
    if command -v apk >/dev/null 2>&1;    then pkg_mgr="apk"; fi

    # tar & gzip — almost always present, but install if missing
    command -v tar    >/dev/null 2>&1 || {
        case "$pkg_mgr" in
            apt) missing_pkgs+=("tar") ;;
            dnf|yum) missing_pkgs+=("tar") ;;
            brew) missing_pkgs+=("gnu-tar") ;;
            apk) missing_pkgs+=("tar") ;;
        esac
    }
    command -v gzip   >/dev/null 2>&1 || missing_pkgs+=("gzip")

    # aws-cli — try apt first, fall back to pip
    if ! command -v aws >/dev/null 2>&1; then
        case "$pkg_mgr" in
            apt) missing_pkgs+=("awscli") ;;
            dnf|yum) missing_pkgs+=("awscli") ;;
            brew) missing_pkgs+=("awscli") ;;
            apk) missing_pkgs+=("aws-cli") ;;
            *)   missing_pips+=("awscli") ;;
        esac
    fi

    # postgresql-client — provides pg_dump, psql, createdb, dropdb
    if ! command -v pg_dump >/dev/null 2>&1; then
        case "$pkg_mgr" in
            apt) missing_pkgs+=("postgresql-client") ;;
            dnf|yum) missing_pkgs+=("postgresql") ;;
            brew) missing_pkgs+=("libpq") ;;
            apk) missing_pkgs+=("postgresql-client") ;;
        esac
    fi

    # Install system packages
    if [ ${#missing_pkgs[@]} -gt 0 ]; then
        install_pkgs "${missing_pkgs[@]}"
    fi

    # Install pip packages
    if [ ${#missing_pips[@]} -gt 0 ]; then
        if ! command -v pip3 >/dev/null 2>&1; then
            case "$pkg_mgr" in
                apt) install_pkgs "python3-pip" ;;
                dnf|yum) install_pkgs "python3-pip" ;;
                apk) install_pkgs "py3-pip" ;;
            esac
        fi
        log "Installing via pip: ${missing_pips[*]}"
        pip3 install --quiet "${missing_pips[@]}"
    fi

    # Final verification — all tools must now be available
    local still_missing=()
    command -v aws     >/dev/null 2>&1 || still_missing+=("aws")
    command -v pg_dump >/dev/null 2>&1 || still_missing+=("pg_dump")
    command -v psql    >/dev/null 2>&1 || still_missing+=("psql")
    command -v createdb >/dev/null 2>&1 || still_missing+=("createdb")
    command -v dropdb  >/dev/null 2>&1 || still_missing+=("dropdb")
    command -v tar     >/dev/null 2>&1 || still_missing+=("tar")
    command -v gzip    >/dev/null 2>&1 || still_missing+=("gzip")

    if [ ${#still_missing[@]} -gt 0 ]; then
        die "Failed to install: ${still_missing[*]}. Install manually and retry."
    fi

    log "All dependencies available."
}

check_s3_bucket() {
    if ! s3_cmd s3 ls "s3://${S3_BUCKET}/" &>/dev/null; then
        die "Cannot access S3 bucket '${S3_BUCKET}'. Check credentials and connectivity."
    fi
}

# Resolve pg_dump host — inside Docker the DB host is 'localhost' (port exposed),
# but the .env DATABASE_URL uses 'postgres' (Docker service name).
# When running pg_dump from the host, we need localhost.
parse_db_params() {
    local url="${DATABASE_URL}"
    # Expected: postgresql://user:pass@host:port/dbname
    DB_USER=$(echo "$url" | sed -n 's|^postgresql\?://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$url" | sed -n 's|^[^:]*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$url" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    DB_PORT=$(echo "$url" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$url" | sed -n 's|.*/\([^?]*\).*|\1|p')

    [ -z "${DB_PORT:-}" ] && DB_PORT=5432

    # If host is 'postgres' (Docker service name), switch to localhost for host-level pg_dump
    if [ "${DB_HOST}" = "postgres" ]; then
        DB_HOST="localhost"
    fi

    log "DB params: user=${DB_USER}, host=${DB_HOST}, port=${DB_PORT}, db=${DB_NAME}"
}

# ─── Backup Commands ─────────────────────────────────────────────────────────

backup_project() {
    local date_label="${1:-$(date +%Y-%m-%d_%H%M%S)}"
    local tar_file="/tmp/nora-project-${date_label}.tar.gz"
    local s3_key="backups/${date_label}/nora-project.tar.gz"

    log "Compressing project directory (excluding node_modules, .git, frontend/dist)..."
    cd "$PROJECT_DIR"
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='frontend/dist' \
        --exclude='backend/node_modules' \
        --exclude='*.log' \
        -czf "$tar_file" .

    local size
    size=$(du -h "$tar_file" | cut -f1)
    log "Project archive: $tar_file ($size)"

    log "Uploading to s3://${S3_BUCKET}/${s3_key} ..."
    s3_cmd s3 cp "$tar_file" "s3://${S3_BUCKET}/${s3_key}"

    rm -f "$tar_file"
    log "Project backup complete → s3://${S3_BUCKET}/${s3_key}"
}

backup_database() {
    local date_label="${1:-$(date +%Y-%m-%d_%H%M%S)}"
    local dump_file="/tmp/nora-db-${date_label}.sql.gz"
    local s3_key="backups/${date_label}/nora-db.sql.gz"

    parse_db_params

    log "Dumping database '${DB_NAME}' from ${DB_HOST}:${DB_PORT} ..."
    PGPASSWORD="${DB_PASS}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --no-owner \
        --no-acl \
        | gzip > "$dump_file"

    local size
    size=$(du -h "$dump_file" | cut -f1)
    log "Database dump: $dump_file ($size)"

    log "Uploading to s3://${S3_BUCKET}/${s3_key} ..."
    s3_cmd s3 cp "$dump_file" "s3://${S3_BUCKET}/${s3_key}"

    rm -f "$dump_file"
    log "Database backup complete → s3://${S3_BUCKET}/${s3_key}"
}

backup_all() {
    local date_label="${1:-$(date +%Y-%m-%d_%H%M%S)}"
    check_deps
    load_env
    check_s3_bucket

    log "=== Starting full backup (label: ${date_label}) ==="
    backup_project "$date_label"
    backup_database "$date_label"
    log "=== Full backup complete ==="
}

# ─── Restore Commands ────────────────────────────────────────────────────────

download_backup() {
    local date_label="$1"
    local type="$2"  # "project" or "db"
    local s3_key
    local local_file

    case "$type" in
        project)
            s3_key="backups/${date_label}/nora-project.tar.gz"
            local_file="/tmp/nora-project-${date_label}.tar.gz"
            ;;
        db)
            s3_key="backups/${date_label}/nora-db.sql.gz"
            local_file="/tmp/nora-db-${date_label}.sql.gz"
            ;;
        *) die "Unknown backup type: $type" ;;
    esac

    log "Downloading s3://${S3_BUCKET}/${s3_key} ..."
    if ! s3_cmd s3 cp "s3://${S3_BUCKET}/${s3_key}" "$local_file" 2>/dev/null; then
        die "Backup '${date_label}' (${type}) not found on S3. Run 'backup.sh list' to see available backups."
    fi
    echo "$local_file"
}

restore_project() {
    local date_label="$1"
    local tar_file

    tar_file=$(download_backup "$date_label" "project")

    log "Restoring project files to $PROJECT_DIR ..."
    cd "$PROJECT_DIR"
    tar -xzf "$tar_file"
    rm -f "$tar_file"

    log "Project files restored. Run 'pnpm install' in backend/ and frontend/ if rebuilding."
}

restore_database() {
    local date_label="$1"
    local dump_file

    dump_file=$(download_backup "$date_label" "db")
    parse_db_params

    log "Restoring database '${DB_NAME}' ..."
    log "  NOTE: This will DROP and recreate all tables. Existing data will be lost."
    log "  Target: ${DB_HOST}:${DB_PORT}/${DB_NAME} as user '${DB_USER}'"

    # Confirm if running interactively
    if [ -t 0 ]; then
        read -r -p "Proceed with database restore? [y/N] " confirm
        if [ "${confirm,,}" != "y" ] && [ "${confirm,,}" != "yes" ]; then
            log "Aborted by user."
            rm -f "$dump_file"
            exit 0
        fi
    fi

    # Drop & recreate the database to get a clean slate
    log "Dropping and recreating database (all existing data will be lost)..."
    PGPASSWORD="${DB_PASS}" dropdb \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        --if-exists \
        "${DB_NAME}" 2>/dev/null || true

    PGPASSWORD="${DB_PASS}" createdb \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        "${DB_NAME}"

    log "Importing SQL dump ..."
    gunzip -c "$dump_file" | PGPASSWORD="${DB_PASS}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}"

    rm -f "$dump_file"
    log "Database restore complete."
}

restore_all() {
    local date_label="$1"
    check_deps
    load_env
    check_s3_bucket

    log "=== Starting full restore from backup: ${date_label} ==="
    restore_project "$date_label"
    restore_database "$date_label"
    log "=== Full restore complete ==="
    log "Next steps:"
    log "  1. cd $PROJECT_DIR"
    log "  2. pnpm install                  # reinstall dependencies"
    log "  3. pnpm --filter backend run db  # apply Prisma schema if needed"
    log "  4. docker compose up -d          # start the app"
}

# ─── List Backups ────────────────────────────────────────────────────────────

list_backups() {
    load_env
    check_s3_bucket

    log "Available backups on s3://${S3_BUCKET}/backups/:"
    echo ""
    s3_cmd s3 ls "s3://${S3_BUCKET}/backups/" 2>/dev/null \
        | while read -r _ _ _ prefix; do
            # prefix ends with /, strip it
            local label="${prefix%/}"
            echo "  $label"
            s3_cmd s3 ls "s3://${S3_BUCKET}/backups/${label}/" 2>/dev/null \
                | while read -r _ _ size obj; do
                    printf "    %-10s %s\n" "$size" "$obj"
                done
            echo ""
        done
}

# ─── Main ────────────────────────────────────────────────────────────────────

print_usage() {
    echo "Usage:"
    echo "  $0 backup                    Full backup (project + database)"
    echo "  $0 backup-project            Project directory only"
    echo "  $0 backup-db                 Database dump only"
    echo "  $0 restore <YYYY-MM-DD_HHMMSS>   Restore from a specific backup"
    echo "  $0 list                      List all backups on S3"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore 2026-05-27_100000"
    echo "  $0 list"
}

main() {
    if [ $# -eq 0 ]; then
        print_usage
        exit 0
    fi

    local cmd="${1:-}"

    case "$cmd" in
        backup)
            backup_all
            ;;
        backup-project)
            check_deps
            load_env
            check_s3_bucket
            backup_project
            ;;
        backup-db)
            check_deps
            load_env
            check_s3_bucket
            backup_database
            ;;
        restore)
            if [ $# -lt 2 ]; then
                die "Missing date label. Usage: $0 restore <YYYY-MM-DD_HHMMSS>"
            fi
            restore_all "$2"
            ;;
        list)
            list_backups
            ;;
        -h|--help|help)
            print_usage
            ;;
        *)
            err "Unknown command: $cmd"
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
