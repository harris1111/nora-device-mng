import type { Device, Location, Attachment, TransferAttachment, TransferRecord } from '../generated/prisma/client.js';

type DeviceWithRelations = Device & {
  location?: { name: string } | null;
  attachments?: Pick<Attachment, 'id' | 'isPrimary'>[];
  transferRecord?: (TransferRecord & { attachments?: TransferAttachment[] }) | null;
};

function mapTransferRecord(d: DeviceWithRelations) {
  if (d.transferRecord) {
    return {
      id: d.transferRecord.id,
      owned_by: d.transferRecord.ownedBy || null,
      transfer_to: d.transferRecord.transferTo || null,
      transfer_date: d.transferRecord.transferDate?.toISOString() || null,
      attachments: (d.transferRecord.attachments || []).map((attachment) => ({
        id: attachment.id,
        file_name: attachment.fileName,
        file_type: attachment.fileType,
        file_size: attachment.fileSize,
        created_at: attachment.createdAt.toISOString(),
      })),
    };
  }

  if (!d.ownedBy && !d.transferTo && !d.transferDate) {
    return null;
  }

  return {
    id: null,
    owned_by: d.ownedBy || null,
    transfer_to: d.transferTo || null,
    transfer_date: d.transferDate?.toISOString() || null,
    attachments: [],
  };
}

export function mapDevice(d: DeviceWithRelations) {
  return {
    id: d.id,
    store_id: d.storeId,
    name: d.name,
    location_id: d.locationId,
    location_name: d.location?.name || null,
    managed_by: d.managedBy,
    owned_by: d.ownedBy,
    serial_number: d.serialNumber,
    model: d.model,
    manufacturer: d.manufacturer,
    description: d.description,
    type: d.type,
    status: d.status,
    disposal_date: d.disposalDate?.toISOString() || null,
    loss_date: d.lossDate?.toISOString() || null,
    transfer_to: d.transferTo || null,
    transfer_date: d.transferDate?.toISOString() || null,
    transfer_record: mapTransferRecord(d),
    primary_attachment_id: d.attachments?.find(a => a.isPrimary)?.id || null,
    created_at: d.createdAt?.toISOString(),
  };
}

export function mapLocation(l: Location) {
  return {
    id: l.id,
    name: l.name,
    created_at: l.createdAt?.toISOString(),
  };
}
