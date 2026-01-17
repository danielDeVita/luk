/**
 * Formats product condition enum to user-friendly Spanish labels
 */
export function formatProductCondition(condition: string | undefined): string {
  if (!condition) return 'No especificado';

  const conditionMap: Record<string, string> = {
    NUEVO: 'Nuevo',
    USADO_COMO_NUEVO: 'Usado Como Nuevo',
    USADO_BUEN_ESTADO: 'Usado - Buen Estado',
    USADO_ACEPTABLE: 'Usado - Aceptable',
  };

  return conditionMap[condition] || condition;
}
