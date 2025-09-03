// src/components/SnapshotPdfClient.jsx
import html2pdf from "html2pdf.js/dist/html2pdf.bundle.min.js";

/* ---------- helpers ---------- */
const ddmmyyyy = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};

const ageYears = (dob) => {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d)) return "";
  const n = new Date();
  let y = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) y--;
  return `${y}`;
};

async function waitForImagesInDoc(doc, timeoutMs = 12000) {
  const imgs = Array.from(doc.querySelectorAll("img"));
  const tasks = imgs.map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete && img.naturalWidth) return resolve();
        const t = setTimeout(resolve, timeoutMs);
        img.addEventListener(
          "load",
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true }
        );
      })
  );
  try {
    await Promise.race([
      Promise.all(tasks),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
  } catch {}
}

/* ---------- HTML builder (accepts pixel width/height) ---------- */
function buildSnapshotHTML(record, { pageWpx, pageHpx }) {
  const {
    personName,
    designation,
    grade,
    dateOfJoining,
    serviceTenureText,
    dateOfBirth,
    totalExperienceText,
    previousOrganization,
    qualifications,
    majorCertifications,
    meritsForVerticalMovement,
    positionSummary,
    additionalCommentsHeadHR,
    commentsDirectorsOrMD,
    finalDecisionTaken,
    presentedOn,
    headHRName,
    directorOrMDName,
    personPhoto,
    leftLogoUrl = "/left-logo.png",
    rightLogoUrl = "/right-logo.png",
  } = record || {};

  return `
<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
  <div id="snapshot-root">
    <style>
      :root{
        --bg:#ffffff; --ink:#1f2937; --muted:#6b7280;
        --line:#B7B7B7; --label:#f1e6d2; --final:#fff1f2; --titlebar:#111827;
        --radius:8px;
        --page-w:${pageWpx}px;      /* inner content width  (A4 - LR margins) */
        --page-h:${pageHpx}px;      /* inner content height (A4 - TB margins) */
        --head-h:60px; --title-h:48px; --foot-h:36px; --gap:12px;
        --label-col:300px;
      }
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{margin:0;padding:0}
      body{
        width:var(--page-w); height:var(--page-h);
        background:var(--bg); color:var(--ink);
        font:13px/1.4 Arial,Helvetica,sans-serif; overflow:hidden;
      }

      /* Header + Title */
      .headbar{height:var(--head-h);display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--line);background:#fafafa}
      .photo{width:60px;height:60px;border:1px solid #c7c7c7;overflow:hidden;background:#fff}
      .photo img{width:100%;height:100%;object-fit:cover}
      .logo{height:50px;object-fit:contain}
      .titlebar{height:var(--title-h);display:flex;align-items:center;padding:0 16px;border-bottom:3px solid var(--titlebar);font-weight:800;font-size:20px}

      /* Content grid */
      .content{
        height: calc(var(--page-h) - var(--head-h) - var(--title-h) - var(--foot-h));
        padding: var(--gap);
        display:grid; grid-template-columns:1.25fr 1fr; gap:var(--gap);
      }

      /* LEFT table */
      .tableWrap{height:100%;display:flex;flex-direction:column;border:1px solid var(--line);background:#fff;overflow:hidden}
      .table{height:100%;display:flex;flex-direction:column}
      .row{
        display:grid; grid-template-columns:var(--label-col) 1fr;
        border-bottom:1px solid var(--line); min-height:32px;
      }
      .row.grow{ flex:1 1 auto; }
      .cellL{background:var(--label);border-right:1px solid var(--line);padding:8px 10px;font-weight:700;color:#0f172a}
      .cellR{background:#fff;padding:8px 10px;overflow:hidden;text-overflow:ellipsis;white-space:pre-wrap;word-wrap:break-word}

      /* RIGHT column */
      .right{height:100%;display:grid;grid-template-rows:1fr 0.9fr 0.9fr auto;gap:var(--gap)}
      .panel{display:flex;flex-direction:column;border:1px solid var(--line);background:#fff;overflow:hidden}
      .panelHead{background:var(--label);padding:8px 10px;font-weight:500;border-bottom:1px solid var(--line)}
      .panelBody{padding:10px;overflow:auto;white-space:pre-wrap}
      .panelBody::-webkit-scrollbar{width:0;height:0}
      .final .panelBody{background:var(--final)}

      /* Signatures */
      .signRow{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap);align-items:end}
      .sign{display:flex;flex-direction:column;gap:6px}
      .signBox{height:64px;border:1px solid var(--line);background:#f8fafc}
      .signCap{font-size:12px;color:#374151}

      /* Footer */
      .footer{
        height:var(--foot-h); display:flex; align-items:center;
        justify-content:space-between; padding:6px 12px;
        font-size:11px; color:#4b5563; border-top:1px solid var(--line); font-style:italic;
      }
      .footer .left{white-space:nowrap}
      .footer .right{display:flex; gap:12px; align-items:center; white-space:nowrap}
      .footer .ver{font-style:normal}
      .bold{font-weight:700}
    </style>

    <!-- HEADER -->
    <div class="headbar">
      <div class="photo">
        ${personPhoto ? `<img src="${personPhoto}" alt="photo" crossorigin="anonymous"/>` : ""}
      </div>
      <img src="${leftLogoUrl}" class="logo" alt="left" crossorigin="anonymous"/>
      <img src="${rightLogoUrl}" class="logo" alt="right" crossorigin="anonymous"/>
    </div>

    <!-- TITLE -->
    <div class="titlebar">Profile Snapshot</div>

    <!-- CONTENT -->
    <div class="content">
      <!-- LEFT -->
      <div class="tableWrap">
        <div class="table">
          <div class="row"><div class="cellL">Name (Mr/Ms)</div><div class="cellR">${personName || "—"}</div></div>
          <div class="row"><div class="cellL">Designation, Grade</div><div class="cellR">${[designation, grade].filter(Boolean).join(", ") || "—"}</div></div>
          <div class="row"><div class="cellL">Date of Joining</div><div class="cellR">${ddmmyyyy(dateOfJoining) || "—"}</div></div>
          <div class="row"><div class="cellL">Service Tenure with Organization</div><div class="cellR">${serviceTenureText || "—"}</div></div>
          <div class="row"><div class="cellL">Date of Birth & Age (in Years)</div><div class="cellR">${ddmmyyyy(dateOfBirth)}${dateOfBirth ? `  (${ageYears(dateOfBirth)})` : ""}</div></div>
          <div class="row"><div class="cellL">Total Exp in domain, & Industry</div><div class="cellR">${totalExperienceText || "—"}</div></div>

          <div class="row grow"><div class="cellL">Previous Organization (max upto 3)</div><div class="cellR">${previousOrganization || "—"}</div></div>
          <div class="row"><div class="cellL">Qualification</div><div class="cellR">${Array.isArray(qualifications) ? qualifications.join(", ") : qualifications || "—"}</div></div>
          <div class="row"><div class="cellL">Major Certification(s)</div><div class="cellR">${Array.isArray(majorCertifications) ? majorCertifications.join(", ") : majorCertifications || "—"}</div></div>
          <div class="row"><div class="cellL">Merit for vertical movement</div><div class="cellR">${Array.isArray(meritsForVerticalMovement) ? meritsForVerticalMovement.join("\\n") : meritsForVerticalMovement || "—"}</div></div>

          <div class="row grow"><div class="cellL">Position Summary</div><div class="cellR">${positionSummary || "—"}</div></div>
        </div>
      </div>

      <!-- RIGHT -->
      <div class="right">
        <div class="panel">
          <div class="panelHead">Additional Comments or Note(s) by Head HR</div>
          <div class="panelBody">${(additionalCommentsHeadHR || "").replace(/\\n/g,"<br/>")}</div>
        </div>

        <div class="panel">
          <div class="panelHead">Comments of Director(s) or MD</div>
          <div class="panelBody">${(commentsDirectorsOrMD || "").replace(/\\n/g,"<br/>")}</div>
        </div>

        <div class="panel">
          <div class="panelHead">Final Decision taken</div>
          <div class="panelBody">${(finalDecisionTaken || "").replace(/\\n/g,"<br/>")}</div>
        </div>

        <div class="signRow">
          <div class="sign">
            <div class="signBox"></div>
            <div class="signCap">Head-HR${headHRName ? ` — ${headHRName}` : ""}</div>
          </div>
          <div class="sign">
            <div class="signBox"></div>
            <div class="signCap">Director or MD${directorOrMDName ? ` — ${directorOrMDName}` : ""}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="left">Presented by Human Resources on <span class="bold">${ddmmyyyy(presentedOn) || "—"}</span></div>
      <div class="right"><span>for Confidential discussion with Board of Directors</span><span class="ver">V1.0</span></div>
    </div>
  </div>
</body>
</html>
`;
}

/* ---------- main generator (fits exactly one page with margins) ---------- */
export async function generateSnapshotPdfClient(
  record,
  { action = "open", filename = "profile-snapshot.pdf", marginMm = 5 } = {}
) {
  const H2P = (html2pdf && (html2pdf.default || html2pdf)) || window.html2pdf;

  // filename
  const rawName = (record?.personName || "Profile Snapshot").toString().trim();
  const cleanBase = rawName.replace(/[\/\\?%*:|"<>]+/g, "").replace(/\s+/g, " ").slice(0, 120);
  const outFilename =
    !filename || filename === "profile-snapshot.pdf"
      ? `Profile Snapshot - ${cleanBase}.pdf`
      : filename;

  // convert mm ↔ px (html2canvas assumes 96 dpi)
  const PX_PER_MM = 96 / 25.4; // ≈ 3.779527559
  const mmToPx = (mm) => Math.round(mm * PX_PER_MM);

  // A4 landscape outer size
  const A4_W_MM = 297;
  const A4_H_MM = 210;

  // inner content size (subtract margins)
  const contentWpx = mmToPx(A4_W_MM - 2 * marginMm);
  const contentHpx = mmToPx(A4_H_MM - 2 * marginMm);

  // normalize possible binary logos/photos to blob URLs
  const toRevoke = [];
  const r = { ...record };
  const toBlobUrl = (obj, fallbackType) => {
    try {
      const bytes = Array.isArray(obj?.data?.data)
        ? obj.data.data
        : Array.isArray(obj?.data)
        ? obj.data
        : null;
      if (!bytes) return null;
      return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: obj?.contentType || fallbackType }));
    } catch {
      return null;
    }
  };
  if (!r.personPhoto && typeof r.personPhotoUrl === "string") r.personPhoto = r.personPhotoUrl;
  if (r.personPhoto && typeof r.personPhoto === "object") {
    const u = toBlobUrl(r.personPhoto, "image/jpeg"); if (u) { r.personPhoto = u; toRevoke.push(u); }
  }
  if (r.leftLogo && typeof r.leftLogo === "object") {
    const u = toBlobUrl(r.leftLogo, "image/png"); if (u) { r.leftLogoUrl = u; toRevoke.push(u); }
  }
  if (r.rightLogo && typeof r.rightLogo === "object") {
    const u = toBlobUrl(r.rightLogo, "image/png"); if (u) { r.rightLogoUrl = u; toRevoke.push(u); }
  }
  r.leftLogoUrl ||= "/left-logo.png";
  r.rightLogoUrl ||= "/right-logo.png";

  // isolated iframe sized to the INNER content area (so it fits one page with margins)
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${contentWpx}px`,
    height: `${contentHpx}px`,
    opacity: "0.001",
    pointerEvents: "none",
    background: "transparent",
  });
  document.body.appendChild(iframe);

  try {
    // write full HTML with the inner content size
    const html = buildSnapshotHTML(r, { pageWpx: contentWpx, pageHpx: contentHpx });
    const doc = iframe.contentDocument;
    doc.open(); doc.write(html); doc.close();

    const root = doc.getElementById("snapshot-root") || doc.body;

    // allow layout + fonts + images
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    if (doc.fonts?.ready) { try { await doc.fonts.ready; } catch {} }
    await waitForImagesInDoc(doc);

    // html2pdf options
    const opt = {
      margin: [marginMm, marginMm, marginMm, marginMm],     // 5mm on all sides
      filename: outFilename,
      image: { type: "jpeg", quality: 0.92 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 20000,
        foreignObjectRendering: false,
        windowWidth: contentWpx,
        windowHeight: contentHpx,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"] }, // keep your grow layout; no forced breaks
    };

    const worker = H2P().set(opt).from(root);

    // open or download
    const pdf = await worker.toPdf().get("pdf");
    const blob = await pdf.output("blob");
    const url = URL.createObjectURL(blob);

    if (action === "open") {
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.download = outFilename; document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else {
      const a = document.createElement("a");
      a.href = url; a.download = outFilename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  } catch (err) {
    console.error("[SnapshotPdfClient] html2pdf worker failed:", err);
  } finally {
    try { document.body.removeChild(iframe); } catch {}
    toRevoke.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
  }
}
