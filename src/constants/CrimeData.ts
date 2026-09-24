export const lifeCrimesKeys = [
  'HOMICÍDIO DOLOSO',
  'HOMICÍDIO CULPOSO OUTROS',
  'TENTATIVA DE HOMICÍDIO',
  'LATROCÍNIO',
  'HOMICÍDIO CULPOSO POR ACIDENTE DE TRÂNSITO',
  'LESÃO CORPORAL SEGUIDA DE MORTE',
];

export const physicalCrimesKeys = [
  'ESTUPRO',
  'ESTUPRO DE VULNERÁVEL',
  'LESÃO CORPORAL DOLOSA',
  'LESÃO CORPORAL CULPOSA - OUTRAS',
  'LESÃO CORPORAL CULPOSA POR ACIDENTE DE TRÂNSITO',
];

export const patrimonyCrimesKeys = [
  'ROUBO A BANCO',
  'ROUBO DE CARGA',
  'ROUBO DE VEÍCULO',
  'FURTO DE VEÍCULO',
  'FURTO - OUTROS',
  'ROUBO - OUTROS',
];

export const formatCrimeName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('roubo a banco')) return 'Roubo a Banco';
  if (lower.includes('furto de veículo')) return 'Furto de Veículo';
  if (lower.includes('roubo de veículo')) return 'Roubo de Veículo';
  if (lower.includes('furto de carga')) return 'Furto de Carga';
  if (lower.includes('roubo de carga')) return 'Roubo de Carga';
  if (lower.includes('homicídio doloso')) return 'Homicídio Doloso';
  if (lower.includes('homicídio culposo outros')) return 'Homicídio Culp. (Outros)';
  if (lower.includes('homicídio culposo por acidente')) return 'Homicídio Culp. (Trânsito)';
  if (lower.includes('homicídio culposo')) return 'Homicídio Culposo';
  if (lower.includes('tentativa de homicídio')) return 'Tentativa de Homicídio';
  if (lower.includes('latrocínio')) return 'Latrocínio';
  if (lower.includes('estupro de vulnerável')) return 'Estupro de Vulnerável';
  if (lower.includes('estupro')) return 'Estupro';
  if (lower.includes('lesão corporal seguida')) return 'Lesão Corp. Seg. Morte';
  if (lower.includes('lesão corporal dolosa')) return 'Lesão Corporal Dolosa';
  if (lower.includes('lesão corporal culposa - outras') || lower.includes('lesão corporal culposa outras')) return 'Lesão Corp. Culp. (Outras)';
  if (lower.includes('lesão corporal culposa por acidente')) return 'Lesão Corp. Culp. (Trânsito)';
  if (lower.includes('lesão corporal culposa')) return 'Lesão Corporal Culposa';
  if (lower.includes('lesão corporal')) return 'Lesão Corporal';
  if (lower.includes('furto')) return 'Furtos';
  if (lower.includes('roubo')) return 'Roubos';

  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

export const getCrimeIcon = (name: string): { icon: string; color: string } => {
  const lower = name.toLowerCase();
  const up = name.toUpperCase();

  // 1. Determinar a cor padronizada pela categoria
  let color = '#64748b'; // Cinza padrão (Patrimônio)
  if (lifeCrimesKeys.includes(up) || lower.includes('homicídio') || lower.includes('latrocínio')) {
    color = '#000000'; // Vida: Preto
  } else if (physicalCrimesKeys.includes(up) || lower.includes('estupro') || lower.includes('lesão')) {
    color = '#dc2626'; // Integridade Física: Vermelho
  } else if (patrimonyCrimesKeys.includes(up) || lower.includes('roubo') || lower.includes('furto')) {
    color = '#64748b'; // Patrimônio: Cinza
  }

  // 2. Determinar o ícone específico
  let icon = 'circle-exclamation';
  if (lower.includes('banco')) icon = 'building-columns';
  else if (lower.includes('carga')) icon = 'truck-ramp-box';
  else if (lower.includes('veículo') || lower.includes('veiculo')) icon = 'car-side';
  else if (lower.includes('trânsito') || lower.includes('transito')) icon = 'car-burst';
  else if (lower.includes('latrocínio') || lower.includes('latrocinio')) icon = 'sack-xmark';
  else if (lower.includes('homicídio') || lower.includes('homicidio')) icon = 'skull-crossbones';
  else if (lower.includes('estupro')) icon = 'shield-heart';
  else if (lower.includes('lesão') || lower.includes('lesao')) icon = 'user-injured';
  else if (lower.includes('furto')) icon = 'bag-shopping';
  else if (lower.includes('roubo')) icon = 'mask';

  return { icon, color };
};

export const mapNatureOptions = [
  {
    id: 'life' as const,
    label: 'Crimes contra a Vida',
    color: '#000000',
    icon: 'skull-crossbones',
    keys: lifeCrimesKeys,
  },
  {
    id: 'physical' as const,
    label: 'Integridade Física',
    color: '#FF0000',
    icon: 'person-falling-burst',
    keys: physicalCrimesKeys,
  },
  {
    id: 'patrimony' as const,
    label: 'Patrimônio',
    color: '#666666',
    icon: 'building-shield',
    keys: patrimonyCrimesKeys,
  },
];
