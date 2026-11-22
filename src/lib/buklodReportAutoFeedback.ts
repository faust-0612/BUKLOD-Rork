/** Local, advisory report feedback. No AI API, quota judgement, or mutation of submitted data. */
export type ReportFeedbackField = {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
};

export type ReportFeedbackInput = {
  content: Record<string, unknown>;
  fields?: ReportFeedbackField[];
  deadlineAt?: string | null;
  submitted?: boolean;
  now?: number;
};

export type ReportFeedback = {
  level: 'ready' | 'suggestions' | 'needs_attention';
  title: string;
  notes: string[];
  deadlineNote: string | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function validWholeNumber(value: string): boolean {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed);
}

/**
 * Advisory only. Blank optional data is not interpreted as zero or failure.
 * Feedback is derived from the current draft or submitted content every render;
 * it is not written back into the report itself.
 */
export function evaluateReportFeedback(input: ReportFeedbackInput): ReportFeedback {
  const content = objectValue(input.content);
  const issues: string[] = [];
  const suggestions: string[] = [];
  const fields = input.fields ?? [];
  const answers = objectValue(content.answers);

  if (fields.length > 0) {
    let answered = 0;
    for (const field of fields) {
      const value = textValue(answers[field.id]);
      if (value) answered += 1;
      if (field.required && !value) {
        issues.push('Sagutan ang required field: ' + field.label + '.');
        continue;
      }
      if (value && field.type === 'number' && !validWholeNumber(value)) {
        issues.push('I-check ang bilang sa ' + field.label + ': gumamit ng whole number na 0 o mas mataas.');
      }
      if (value && field.type === 'long_text' && value.length < 15) {
        suggestions.push('Dagdagan ng maikling detalye ang ' + field.label + ' para madaling ma-review.');
      }
    }
    if (answered === 0 && issues.length === 0) {
      suggestions.push('Maglagay ng aktuwal na impormasyon para sa panahong ito. Optional fields ay maaaring iwang blanko.');
    }
  } else {
    const activities = objectValue(content.activities);
    const entries = Object.values(activities).map(objectValue);
    const activeEntries = entries.filter((entry) => entry.selected === true || textValue(entry.note) !== '');
    if (activeEntries.length === 0 && !textValue(content.additional_note)) {
      suggestions.push('Ilarawan ang mga naging gawain o ilagay kung walang pangunahing aktibidad ngayong linggo.');
    } else if (activeEntries.some((entry) => entry.selected === true && !textValue(entry.note))) {
      suggestions.push('Sa mga napiling aktibidad, maaaring magdagdag ng maikling resulta o nangyari.');
    }

    const people = objectValue(content.people);
    for (const [key, raw] of Object.entries(people)) {
      const value = textValue(raw);
      if (value && !validWholeNumber(value)) {
        issues.push('I-check ang bilang sa ' + key.replace(/_/g, ' ') + ': whole number na 0 o mas mataas ang kailangan.');
      }
    }
    const worshipTotal = textValue(people.worship_total);
    const adults = textValue(people.adults);
    const youth = textValue(people.youth);
    const children = textValue(people.children);
    if ([worshipTotal, adults, youth, children].every(validWholeNumber) &&
        Number(adults) + Number(youth) + Number(children) > Number(worshipTotal)) {
      suggestions.push('I-check kung ang adults, youth at children ay tumutugma sa worship total.');
    }

    const concern = objectValue(content.concern);
    const concernType = textValue(concern.type);
    if (concernType && concernType !== 'Wala / Normal' && !textValue(concern.note)) {
      suggestions.push('May concern na napili. Magbigay ng maikling konteksto at kung anong suporta ang kailangan.');
    }
    const nextPeriod = objectValue(content.next_period);
    if (!textValue(nextPeriod.main_goal)) {
      suggestions.push('Maglagay ng isang konkretong ministry goal o susunod na hakbang para sa susunod na linggo.');
    }
    if (textValue(nextPeriod.assistance_needed) &&
        textValue(nextPeriod.assistance_needed) !== 'None' &&
        !textValue(concern.note) && !textValue(content.additional_note)) {
      suggestions.push('Ipaliwanag kung paano makakatulong ang hiniling na assistance para makapag-follow up ang leader.');
    }
    if (activeEntries.length > 0 &&
        !Array.isArray(content.evidence_photos)) {
      // Older report versions may not contain the evidence array. It remains optional.
    }
  }

  const deadline = input.deadlineAt ? Date.parse(input.deadlineAt) : NaN;
  const deadlineNote = Number.isFinite(deadline) && !input.submitted && (input.now ?? Date.now()) > deadline
    ? 'Lampas na ang deadline. Maaari pa ring magsumite kung pinapayagan ng report schedule; makipag-ugnayan sa leader kung kailangan.'
    : null;
  const notes = [...issues, ...suggestions].slice(0, 5);
  if (issues.length > 5) notes.push('May ' + (issues.length - 5) + ' pang field na dapat tingnan.');
  const level: ReportFeedback['level'] = issues.length > 0 ? 'needs_attention' : suggestions.length > 0 ? 'suggestions' : 'ready';
  return {
    level,
    title: issues.length > 0
      ? 'May mga sagot na kailangang ayusin'
      : suggestions.length > 0
        ? 'Mga mungkahi para mas malinaw ang report'
        : 'Maayos ang naitalang impormasyon',
    notes: notes.length > 0 ? notes : ['Wala nang nakitang basic content issue. Maaari nang i-review ang report.'],
    deadlineNote,
  };
}
