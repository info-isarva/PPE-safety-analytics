const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const outDir = path.join(__dirname, "..", "release");
const unpacked = path.join(outDir, "win-unpacked");
const zipPath = path.join(outDir, "PPE-Safety-Analytics-1.0.0-portable.zip");
const fallbackUnpacked = "D:\\ppe-desktop-release\\win-unpacked";

const sourceUnpacked = fs.existsSync(unpacked)
  ? unpacked
  : fs.existsSync(fallbackUnpacked)
    ? fallbackUnpacked
    : null;

if (!sourceUnpacked) {
  console.error("Missing unpacked app. Expected:", unpacked);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  execFileSync(
    "tar",
    ["-a", "-c", "-f", zipPath, "-C", sourceUnpacked, "."],
    { stdio: "inherit" }
  );
} catch {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${sourceUnpacked}\\*' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: "inherit" }
  );
}

const exeName = "PPE Safety Analytics.exe";
console.log("Portable zip:", zipPath);
console.log("Run app:", path.join(sourceUnpacked, exeName));
