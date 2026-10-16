declare module "heic-convert" {
  type ConvertInput = {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function convert(
    input: ConvertInput,
  ): Promise<ArrayBuffer>;
}
