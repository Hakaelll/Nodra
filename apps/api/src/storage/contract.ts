export type StoredObject = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export interface ObjectStorageProvider {
  getObject(key: string): Promise<Buffer | null>;
  putObject(object: StoredObject): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol("ObjectStorageProvider");

export function assertObjectKey(key: string) {
  if (
    key.length > 200 ||
    !/^(?:[a-z0-9][a-z0-9-]*\/)*[a-z0-9][a-z0-9.-]*$/.test(key)
  )
    throw new Error("Invalid object storage key");
}

export function assertContentType(contentType: string) {
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(contentType))
    throw new Error("Invalid object content type");
}
