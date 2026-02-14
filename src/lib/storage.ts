import { Storage } from "@google-cloud/storage";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getStorage = () => new Storage();

const parseBase64Image = (dataUrl: string) => {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    return { buffer: Buffer.from(dataUrl, "base64"), contentType: "image/png" };
  }
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const match = header.match(/data:(.*?);base64/);
  const contentType = match?.[1] || "image/png";
  return { buffer: Buffer.from(base64, "base64"), contentType };
};

export const uploadCardImage = async (args: {
  cardId: string;
  kind: string;
  dataUrl: string;
}): Promise<string> => {
  const bucketName = requireEnv("GCS_BUCKET");
  const { buffer, contentType } = parseBase64Image(args.dataUrl);
  const storage = getStorage();
  const filePath = `cards/${args.cardId}/${args.kind}.png`;
  const file = storage.bucket(bucketName).file(filePath);

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: "2035-01-01",
  });

  return url;
};
