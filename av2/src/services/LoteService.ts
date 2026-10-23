import { LoteRepository } from '../repositories/LoteRepository';
import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { JournalRepository } from '../repositories/JournalRepository';

export class LoteService {
  private loteRepo: LoteRepository;
  private orgRepo: OrganizacaoRepository;
  private equipRepo: EquipamentoRepository;
  private journalRepo: JournalRepository;

  constructor() {
    this.loteRepo = new LoteRepository();
    this.orgRepo = new OrganizacaoRepository();
    this.equipRepo = new EquipamentoRepository();
    this.journalRepo = new JournalRepository();
  }

  public static validarDataEntrada(dataInput: Date | string): boolean {
    const data = dataInput instanceof Date ? dataInput : new Date(dataInput);
    if (isNaN(data.getTime())) return false;

    const agora = new Date();
    const limiteFuturo = new Date(agora.getTime() + 60 * 1000);
    const limitePassado = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);

    return data.getTime() <= limiteFuturo.getTime() && data.getTime() >= limitePassado.getTime();
  }

  public async criarLote(
    dados: {
      id?: string;
      dataEntrada: string | Date;
      organizacaoId: string;
      notaFiscal: string;
      transportadora: string;
      observacoes?: string;
      equipamentos?: Array<{
        id?: string;
        tipo: string;
        marca: string;
        modelo: string;
        anoFabricacao: number;
        estadoFisico: string;
        pesoQuilogramas: number;
        posicaoNoLote?: number;
      }>;
    },
    operador: string
  ) {
    if (!LoteService.validarDataEntrada(dados.dataEntrada)) {
      throw new Error(
        `Data de entrada inválida. A data não pode ser futura nem anterior a 90 dias (${dados.dataEntrada}).`
      );
    }

    const org = await this.orgRepo.findById(dados.organizacaoId);
    if (!org) {
      throw new Error(`Organização geradora '${dados.organizacaoId}' não encontrada.`);
    }

    const totalExistentes = await this.equipRepo.countAll();
    const anoAtual = new Date().getFullYear();

    const equipamentosComBarcodes = (dados.equipamentos || []).map((eq, index) => {
      const seq = totalExistentes + index + 1;
      const seqStr = String(seq).padStart(5, '0');
      const codigoBarras = `GC-${eq.tipo}-${anoAtual}-${seqStr}`;
      return {
        id: eq.id,
        codigoBarrasInterno: codigoBarras,
        tipo: eq.tipo,
        marca: eq.marca,
        modelo: eq.modelo,
        anoFabricacao: eq.anoFabricacao,
        estadoFisico: eq.estadoFisico,
        pesoQuilogramas: eq.pesoQuilogramas,
        posicaoNoLote: eq.posicaoNoLote || (index + 1)
      };
    });

    const loteCriado = await this.loteRepo.createWithEquipamentos(
      {
        id: dados.id,
        dataEntrada: new Date(dados.dataEntrada),
        organizacaoId: dados.organizacaoId,
        notaFiscal: dados.notaFiscal,
        transportadora: dados.transportadora,
        observacoes: dados.observacoes
      },
      equipamentosComBarcodes
    );

    await this.journalRepo.record('CRIAR_LOTE', 'Lote', operador, null, loteCriado);
    return loteCriado;
  }

  public async buscarPorId(id: string) {
    const lote = await this.loteRepo.findById(id);
    if (!lote) {
      throw new Error(`Lote '${id}' não encontrado.`);
    }
    return lote;
  }

  public async listar(filtro?: { organizacaoId?: string; status?: string }) {
    return this.loteRepo.listAll(filtro);
  }

  public async concluirTriagem(loteId: string, operador: string, versaoEsperada?: number) {
    const loteAtualizado = await this.loteRepo.completeTriage(loteId, versaoEsperada);
    await this.journalRepo.record('CONCLUIR_TRIAGEM', 'Lote', operador, null, loteAtualizado);
    return loteAtualizado;
  }
}
