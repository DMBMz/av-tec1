import { Validador } from './Validador';

export class ValidadorCNPJ extends Validador {
  public validar(cnpjInput: string): boolean {
    if (!cnpjInput || typeof cnpjInput !== 'string') {
      this.mensagemErro = 'CNPJ não fornecido ou formato inválido.';
      return false;
    }

    // Remove caracteres não numéricos
    const cnpj = cnpjInput.replace(/[^\d]+/g, '');

    if (cnpj.length !== 14) {
      this.mensagemErro = `CNPJ deve conter 14 dígitos. Fornecido: ${cnpj.length} dígitos.`;
      return false;
    }

    // Rejeita sequências com todos os dígitos repetidos (ex: 00000000000000)
    if (/^(\d)\1{13}$/.test(cnpj)) {
      this.mensagemErro = 'CNPJ inválido (dígitos repetidos).';
      return false;
    }

    // Validação do primeiro dígito verificador
    let tamanho = 12;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) {
      this.mensagemErro = 'Primeiro dígito verificador do CNPJ é inválido.';
      return false;
    }

    // Validação do segundo dígito verificador
    tamanho = 13;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1), 10)) {
      this.mensagemErro = 'Segundo dígito verificador do CNPJ é inválido.';
      return false;
    }

    this.mensagemErro = '';
    return true;
  }
}
