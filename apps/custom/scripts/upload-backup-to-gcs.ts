import { Storage } from "@google-cloud/storage";
import fs from "fs";

async function main() {
  const filePath = process.argv[2];
  const destination = process.argv[3];
  const bucketName = process.env.GCS_BUCKET || "qubere-demo-uploaded-documents";

  if (!filePath || !destination) {
    console.error("Usage: upload-backup-to-gcs <filePath> <destination>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
  }

  console.log(`Uploading ${filePath} to gs://${bucketName}/${destination}...`);
  const storage = new Storage();
  await storage.bucket(bucketName).upload(filePath, {
    destination,
    metadata: {
      contentType: "application/octet-stream",
    },
  });
  console.log(`Successfully uploaded to gs://${bucketName}/${destination}`);
}

main().catch((err) => {
  console.error("GCS Upload failed:", err);
  process.exit(1);
});
