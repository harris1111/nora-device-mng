import type { TransferAttachment, TransferRecord } from '../generated/prisma/client.js';
import prisma from '../lib/prisma-client.js';

export interface TransferSummaryInput {
  ownedBy: string;
  transferTo: string | null;
  transferDate: Date | null;
}

export type TransferRecordWithAttachments = TransferRecord & {
  attachments: TransferAttachment[];
};

type TransferRecordDb = Pick<typeof prisma, 'device' | 'transferRecord'>;

const transferRecordInclude = {
  attachments: {
    orderBy: { createdAt: 'asc' as const },
  },
};

function hasTransferSummary(summary: TransferSummaryInput): boolean {
  return Boolean(summary.ownedBy || summary.transferTo || summary.transferDate);
}

export async function syncDeviceTransferRecord(
  deviceId: string,
  summary: TransferSummaryInput,
  db: TransferRecordDb = prisma,
): Promise<TransferRecordWithAttachments | null> {
  const existing = await db.transferRecord.findUnique({
    where: { deviceId },
    include: transferRecordInclude,
  });

  const data = {
    ownedBy: summary.ownedBy,
    transferTo: summary.transferTo,
    transferDate: summary.transferDate,
  };

  if (existing && !hasTransferSummary(summary) && existing.attachments.length === 0) {
    await db.transferRecord.delete({ where: { deviceId } });
    return null;
  }

  if (existing) {
    return db.transferRecord.update({
      where: { deviceId },
      data,
      include: transferRecordInclude,
    });
  }

  if (!hasTransferSummary(summary)) {
    return null;
  }

  return db.transferRecord.create({
    data: {
      deviceId,
      ...data,
    },
    include: transferRecordInclude,
  });
}

export async function ensureTransferRecordForDevice(
  deviceId: string,
  db: TransferRecordDb = prisma,
): Promise<TransferRecordWithAttachments | null> {
  const device = await db.device.findUnique({
    where: { id: deviceId },
    select: {
      ownedBy: true,
      transferTo: true,
      transferDate: true,
    },
  });

  if (!device) {
    return null;
  }

  return db.transferRecord.upsert({
    where: { deviceId },
    update: {},
    create: {
      deviceId,
      ownedBy: device.ownedBy,
      transferTo: device.transferTo,
      transferDate: device.transferDate,
    },
    include: transferRecordInclude,
  });
}

export async function cleanupTransferRecordIfEmpty(transferId: string): Promise<void> {
  const transferRecord = await prisma.transferRecord.findUnique({
    where: { id: transferId },
    include: {
      attachments: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!transferRecord) {
    return;
  }

  const hasSummary = Boolean(
    transferRecord.ownedBy || transferRecord.transferTo || transferRecord.transferDate,
  );

  if (!hasSummary && transferRecord.attachments.length === 0) {
    await prisma.transferRecord.delete({ where: { id: transferId } });
  }
}