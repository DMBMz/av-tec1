export abstract class Validador {
  protected mensagemErro: string = '';

  public abstract validar(objeto: any): boolean;

  public obterMensagemErro(): string {
    return this.mensagemErro;
  }
}
