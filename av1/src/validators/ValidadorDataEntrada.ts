import { Validador } from './Validador';

export class ValidadorDataEntrada extends Validador {
  public validar(dataInput: Date | string): boolean {
    const data = dataInput instanceof Date ? dataInput : new Date(dataInput);

    if (isNaN(data.getTime())) {
      this.mensagemErro = 'Data de entrada inválida ou mal formatada.';
      return false;
    }

    const agora = new Date();
    // Normaliza para comparação de dias
    const limiteFuturo = new Date(agora.getTime() + 60 * 1000); // margem de 1 minuto para clock skew
    const limitePassado = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 dias atrás

    if (data.getTime() > limiteFuturo.getTime()) {
      this.mensagemErro = `Data de entrada não pode ser futura (${data.toISOString().split('T')[0]}).`;
      return false;
    }

    if (data.getTime() < limitePassado.getTime()) {
      this.mensagemErro = `Data de entrada não pode ser anterior a 90 dias (${data.toISOString().split('T')[0]}). Limite permitido: ${limitePassado.toISOString().split('T')[0]}.`;
      return false;
    }

    this.mensagemErro = '';
    return true;
  }
}
