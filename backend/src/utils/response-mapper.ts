import type { Device, Location, Attachment } from '../generated/prisma/client.js';

type DeviceWithRelations = Device & {
  location?: { name: string } | null;
  attachments?: Pick<Attachment, 'id' | 'isPrimary'>[];
};

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
