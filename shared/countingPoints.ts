export interface CountingSubPoint {
  code: string;
  name: string;
  fullName: string;
}

export interface CountingPoint {
  code: string;
  name: string;
  fullName: string;
  subPoints: CountingSubPoint[];
}

export interface CountingFlow {
  label: string;
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
}

export function formatPointFullName(code: string, name: string) {
  return `${code} ${name}`.trim();
}

export function formatSubPointFullName(code: string, name: string) {
  return `${code} ${name}`.trim();
}

export function getFlowsForPoint(point: CountingPoint): CountingFlow[] {
  const flows: CountingFlow[] = [];

  for (const subPoint of point.subPoints) {
    flows.push({
      label: `${point.fullName} → ${subPoint.fullName}`,
      from: point.fullName,
      to: subPoint.fullName,
      fromCode: point.code,
      toCode: subPoint.code,
    });

    flows.push({
      label: `${subPoint.fullName} → ${point.fullName}`,
      from: subPoint.fullName,
      to: point.fullName,
      fromCode: subPoint.code,
      toCode: point.code,
    });
  }

  return flows;
}
