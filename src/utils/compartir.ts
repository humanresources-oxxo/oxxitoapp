// src/utils/compartir.ts
// Hands a generated file to the user. Native: writes it to the cache and opens
// the share sheet (WhatsApp, mail, Files, print...). Web: downloads it.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const MIME = {
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uti: 'org.openxmlformats.wordprocessingml.document' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uti: 'org.openxmlformats.spreadsheetml.sheet' },
};

export async function compartirArchivo(bytes: Uint8Array, nombre: string, tipo: { mime: string; uti: string }) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo.mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('este teléfono no permite compartir archivos');
  await Sharing.shareAsync(archivo.uri, { mimeType: tipo.mime, UTI: tipo.uti, dialogTitle: nombre });
}
