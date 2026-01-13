export interface PotentialError {
  errorType: string;
  riskLevel: 'Low' | 'Moderate' | 'High';
  error: string;
  explanation: string;
}

export interface DrugInfo {
  drugName: string;
  drugClass: string;
  mechanismOfAction: string;
  indication: string;
  prescribedDose: string;
  standardDose: string;
  adverseEffects: string;
  monitoring: string;
  precautions: string;
}

export interface LabValue {
  parameter: string;
  value: string;
  unit: string;
  status: 'Normal' | 'Low' | 'High' | 'Abnormal';
  interpretation: string;
}

export interface AnalysisResult {
  potentialErrors: PotentialError[];
  drugInformation: DrugInfo[];
  labInterpretation: LabValue[];
}
