// gltf-validator (Khronos) ships no type declarations; this covers what the model tests use.
declare module "gltf-validator" {
  type Report = { issues: { numErrors: number; numWarnings: number; messages: { code: string; message: string; pointer?: string }[] } };
  const validator: { validateBytes(data: Uint8Array): Promise<Report> };
  export default validator;
}
