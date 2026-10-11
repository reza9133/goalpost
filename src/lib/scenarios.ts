import raw from '../data/scenarios.json';
import type { Dimension, Kind, Verdict } from './types';

export interface ScenarioElement {
  key: string;
  dimension: Dimension;
  quote: string;
  anchors: string[];
}

export interface ScenarioReport {
  id: string;
  label: string;
  period: string;
  path: string;
  expected: Verdict;
}

export interface Scenario {
  id: string;
  title: string;
  kind: Kind;
  summary: string;
  pledge_path: string;
  report_prefix_path: string;
  elements: ScenarioElement[];
  reports: ScenarioReport[];
}

export const SCENARIOS = (raw as unknown as { scenarios: Scenario[] }).scenarios;

export function scenarioForPledgeUrl(pledgeUrl: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => pledgeUrl.endsWith(scenario.pledge_path));
}
