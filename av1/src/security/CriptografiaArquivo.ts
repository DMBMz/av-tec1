import * as crypto from 'crypto';

export class CriptografiaArquivo {
  private static readonly ALGORITMO = 'aes-256-cbc';
  private static readonly IV_LENGTH = 16;

  public gerarChave(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private normalizarChave(chave: string): Buffer {
    if (chave.length === 64) {
      return Buffer.from(chave, 'hex');
    }
    return crypto.createHash('sha256').update(chave).digest();
  }

  public cifrar(dados: string, chave: string): string {
    const key = this.normalizarChave(chave);
    const iv = crypto.randomBytes(CriptografiaArquivo.IV_LENGTH);
    const cipher = crypto.createCipheriv(CriptografiaArquivo.ALGORITMO, key, iv);
    
    let encrypted = cipher.update(dados, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Retorna IV concatenado ao texto cifrado no formato iv:ciphertext
    return `${iv.toString('hex')}:${encrypted}`;
  }

  public decifrar(dadosCifrados: string, chave: string): string {
    const key = this.normalizarChave(chave);
    const partes = dadosCifrados.split(':');
    if (partes.length !== 2) {
      throw new Error('Formato inválido de dados cifrados. Esperado iv:conteudo.');
    }

    const iv = Buffer.from(partes[0], 'hex');
    const ciphertext = partes[1];
    const decipher = crypto.createDecipheriv(CriptografiaArquivo.ALGORITMO, key, iv);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
