import { deviceQrcodeUrl } from '../api/device-api';

interface Props {
  deviceId: string;
  className?: string;
}

export default function QrcodeDisplay({ deviceId, className = '' }: Props) {
  return (
    <img
      src={deviceQrcodeUrl(deviceId)}
      alt="Device QR Code"
      className={className}
    />
  );
}
