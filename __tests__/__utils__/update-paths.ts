export function updatePaths<T extends { source?: string }>(
  path: string,
  data: T[]
): T[] {
  data.forEach((d) => (d.source = d.source?.replace('{{path}}', path)));

  return data;
}

export function updatePath<T extends { source?: string }>(
  path: string,
  data: T
): T {
  const newData = { ...data };

  newData.source = newData.source?.replace('{{path}}', path);

  return newData;
}
