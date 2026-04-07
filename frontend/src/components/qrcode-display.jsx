import { deviceQrcodeUrl } from '../api/device-api';

export default function QrcodeDisplay({ deviceId, className = '' }) {
  return (
    <img
      src={deviceQrcodeUrl(deviceId)}
      alt="Device QR Code"
      className={className}
    />
  );
}
