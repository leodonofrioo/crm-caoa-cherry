import { InstallationStatus, PaymentStatus, SalesStatus } from '../types';

interface PipelineAutomationInput {
  itemCount: number;
  total: number;
  paymentStatus: PaymentStatus;
  installationStatus: InstallationStatus;
  installationDate?: string;
  currentStatus?: SalesStatus;
}

export interface PipelineAutomationResult {
  status: SalesStatus;
  trigger: string;
  nextAction: string;
  progress: number;
  locked: boolean;
}

const installationActiveStatuses: InstallationStatus[] = [
  'Agendada',
  'Aguardando pagamento',
  'Aguardando peça ou acessório',
  'Pronta para instalar',
  'Em instalação',
  'Reagendada',
  'Atrasada',
];

export const getPipelineAutomation = ({
  itemCount,
  total,
  paymentStatus,
  installationStatus,
  installationDate,
  currentStatus,
}: PipelineAutomationInput): PipelineAutomationResult => {
  if (currentStatus === 'Perdido') {
    return {
      status: 'Perdido',
      trigger: 'Perda manual registrada.',
      nextAction: 'Reabrir manualmente se cliente voltar.',
      progress: 0,
      locked: true,
    };
  }

  if (currentStatus === 'Entregue') {
    return {
      status: 'Entregue',
      trigger: 'Entrega finalizada manualmente.',
      nextAction: 'Acompanhar pós-venda.',
      progress: 100,
      locked: true,
    };
  }

  if (installationStatus === 'Instalada') {
    return {
      status: 'Pronto para entrega',
      trigger: 'Instalação marcada como instalada.',
      nextAction: 'Avisar cliente e finalizar entrega.',
      progress: 84,
      locked: false,
    };
  }

  if (installationDate || installationActiveStatuses.includes(installationStatus)) {
    return {
      status: 'Aguardando instalação',
      trigger: installationDate ? 'Data de instalação definida.' : `Status instalação: ${installationStatus}.`,
      nextAction: paymentStatus === 'Paga' ? 'Acompanhar oficina.' : 'Regularizar pagamento antes da instalação.',
      progress: 68,
      locked: false,
    };
  }

  if (paymentStatus === 'Paga' || paymentStatus === 'Paga parcialmente' || paymentStatus === 'Pagamento previsto') {
    return {
      status: 'Aprovado',
      trigger: `Status pagamento: ${paymentStatus}.`,
      nextAction: 'Agendar instalação.',
      progress: 52,
      locked: false,
    };
  }

  if (itemCount > 0 || total > 0) {
    return {
      status: 'Orçamento enviado',
      trigger: `${itemCount} item(ns) na proposta.`,
      nextAction: 'Enviar proposta e cobrar retorno.',
      progress: 30,
      locked: false,
    };
  }

  return {
    status: 'Novo cliente',
    trigger: 'Cadastro iniciado sem itens.',
    nextAction: 'Montar proposta.',
    progress: 12,
    locked: false,
  };
};
