import { TransferRecordItem, transferAttachmentFileUrl, TransferAttachmentItem } from '../../api/device-api';
import AttachmentList from '../attachment/attachment-list';

type AnyAttachment = TransferAttachmentItem;

interface Props {
  transfer: TransferRecordItem | null | undefined;
  onUpload?: (files: File[]) => Promise<void>;
  onDeleteAttachment?: (id: string) => void;
  uploading?: boolean;
  compact?: boolean;
  fileUrlResolver?: (attachment: AnyAttachment) => string;
}

export default function TransferInfoSection({ transfer, onUpload, onDeleteAttachment, uploading, compact = false, fileUrlResolver }: Props) {
  const attachments = transfer?.attachments || [];
  const summaryItems = [
    { label: 'Chuyển giao cho', value: transfer?.owned_by || null },
    { label: 'Người nhận', value: transfer?.transfer_to || null },
    { label: 'Ngày chuyển giao', value: transfer?.transfer_date ? new Date(transfer.transfer_date).toLocaleDateString('vi-VN') : null },
  ].filter((item) => item.value);
  const canManageAttachments = Boolean(onUpload || onDeleteAttachment);

  if (summaryItems.length === 0 && attachments.length === 0 && !canManageAttachments) {
    return null;
  }

  return (
    <div className={compact ? 'bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4' : 'card-glass border border-slate-100 shadow-sm p-6 md:p-8 space-y-4'}>
      <h2 className={compact ? 'text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2' : 'text-lg font-bold text-slate-800 flex items-center gap-2'}>
        <svg className={compact ? 'w-4 h-4 text-emerald-500' : 'w-5 h-5 text-emerald-500'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h5m-9 8h16a2 2 0 002-2V8.414a2 2 0 00-.586-1.414l-4.414-4.414A2 2 0 0015.586 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Thông tin chuyển giao
      </h2>

      {summaryItems.length > 0 && (
        <div className={compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm' : 'grid grid-cols-1 md:grid-cols-3 gap-4'}>
          {summaryItems.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {summaryItems.length === 0 && canManageAttachments && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Chưa có thông tin chuyển giao. Bạn vẫn có thể đính kèm biên bản tại đây hoặc cập nhật nội dung chuyển giao ở màn hình chỉnh sửa thiết bị.
        </div>
      )}

      <AttachmentList
        attachments={attachments}
        onDelete={onDeleteAttachment}
        onUpload={onUpload}
        uploading={uploading}
        maxFiles={5}
        allowUpload={Boolean(onUpload)}
        fileUrlResolver={fileUrlResolver || ((attachment) => transferAttachmentFileUrl(attachment.id))}
        emptyText="Chưa có tệp chuyển giao"
        uploadButtonLabel="Đính kèm tệp chuyển giao"
      />
    </div>
  );
}
