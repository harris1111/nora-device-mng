import { deviceQrcodeUrl } from '../api/device-api';

/**
 * Prints QR label immediately using a hidden iframe.
 * No popup or confirmation — the print dialog opens directly.
 */
export default function PrintQrcodeButton({ deviceId, storeId }) {
  const handlePrint = () => {
    const qrSrc = window.location.origin + deviceQrcodeUrl(deviceId);

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>QR</title>
<style>
  @page {
    size: 0.94in 1.10in;
    margin: 0 !important;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    margin:0; padding:0;
    width:0.94in; height:1.10in;
    overflow:hidden; background:#fff;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .label {
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content: center;
    width: 100%;
  }
  .label img {
    display:block;
    width:0.72in; height:0.72in;
    image-rendering:pixelated;
    image-rendering:crisp-edges;
  }
  .label span {
    display:block;
    margin-top:0.02in;
    font:700 7pt/1 Arial,Helvetica,sans-serif;
    color:#000;
    white-space:nowrap;
    text-align:center;
  }
</style>
</head>
<body>
<div class="label">
  <img id="qr" src="${qrSrc}" alt="QR">
  <span>${storeId}</span>
</div>
</body>
</html>`);
    doc.close();

    const img = doc.getElementById('qr');
    const doPrint = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 2000);
    };

    if (img.complete) {
      doPrint();
    } else {
      img.onload = doPrint;
      img.onerror = doPrint;
    }
  };

  return (
    <button
      onClick={handlePrint}
      className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 flex items-center gap-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
      </svg>
      In Mã QR
    </button>
  );
}
