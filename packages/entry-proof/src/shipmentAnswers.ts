import Decimal from 'decimal.js';
export interface AnswerCard {
    key: string;
    question: string;
    answer: string;
    status: 'OK' | 'ATTENTION' | 'ACTION_REQUIRED' | 'UNKNOWN';
    facts: {
        label: string;
        value: string;
        href?: string;
    }[];
    updatedAt: string;
    askHref?: string;
}
export interface ShipmentAnswerSet {
    shipmentId: string;
    shipmentNumber: string;
    generatedAt: string;
    headline: {
        transportationStatus: string;
        customsStatus: string;
        promiseState: string | null;
        healthLabel: string | null;
    };
    eta: {
        current: string | null;
        previous: string | null;
        changedOn: string | null;
        reason: string | null;
        confidence: number | null;
    };
    cost: {
        dutyAndFeesUsd: number | null;
        brokerChargesUsd: number | null;
        estimatedTotalUsd: number | null;
        costIsPartial: boolean;
        invoices: {
            id: string;
            number: string;
            status: string;
            total: number;
            currency: string;
        }[];
    };
    cards: AnswerCard[];
    milestones: {
        label: string;
        at: string | null;
        location: string | null;
    }[];
    referenceNumbers: {
        label: string;
        value: string;
    }[];
    needsFromYou: {
        id: string;
        label: string;
        dueAt: string | null;
        href: string;
    }[];
}
export interface ShipmentAnswersInput {
    id: string;
    shipmentNumber: string;
    generatedAt: string;
    transportationStatus: string;
    customsStatus: string;
    promiseState: string | null;
    healthLabel: string | null;
    carrierName: string | null;
    portOfEntry: string | null;
    estimatedArrival: string | null;
    lastFreeDay: string | null;
    demurrageExposureUsd: number | null;
    eta?: {
        current: string;
        previous: string | null;
        changedOn: string;
        reasonCode: string | null;
        confidence: number | null;
    } | null;
    publishedEntryCount?: number;
    proofs: {
        dutyAndFeesUsd: number;
        complete: boolean;
    }[];
    charges: {
        netAmount: number;
        currency: string;
        portalVisible: boolean;
        status: string;
    }[];
    invoices: {
        id: string;
        number: string;
        status: string;
        total: number;
        currency: string;
    }[];
    milestones: {
        label: string;
        at: string | null;
        location: string | null;
    }[];
    referenceNumbers: {
        label: string;
        value: string;
    }[];
    requests: {
        id: string;
        title: string;
        status: string;
        dueAt: string | null;
    }[];
    deadlines: {
        id: string;
        customerActionable: boolean;
        customerLabel: string | null;
        status: string;
        dueAt: string | null;
    }[];
    holds: {
        agencyCode: string;
        status: string;
    }[];
}
const sum = (v: number[]) => v.reduce((a, b) => a.plus(b), new Decimal(0)).toDecimalPlaces(2).toNumber();
export function assembleShipmentAnswers(i: ShipmentAnswersInput): ShipmentAnswerSet {
    const invoices = i.invoices.filter(v => ['ISSUED', 'SENT', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'].includes(v.status)).map(v => ({ id: v.id, number: v.number, status: v.status, total: v.total, currency: v.currency }));
    const visibleCharges = i.charges.filter(c => c.portalVisible && c.status !== 'VOIDED');
    const duty = i.proofs.length ? sum(i.proofs.map(p => p.dutyAndFeesUsd)) : null;
    const broker = visibleCharges.some(c => c.currency === 'USD') ? sum(visibleCharges.filter(c => c.currency === 'USD').map(c => c.netAmount)) : null;
    const partial = (i.publishedEntryCount ?? i.proofs.length) > i.proofs.length || duty === null || broker === null || i.proofs.some(p => !p.complete) || visibleCharges.some(c => c.currency !== 'USD');
    const total = duty === null && broker === null ? null : sum([duty ?? 0, broker ?? 0]);
    // Invoice totals are shown separately: adding them to charges would double-count.
    const needs = [...i.requests.filter(r => r.status === 'OPEN').map(r => ({ id: r.id, label: r.title, dueAt: r.dueAt, href: `/requests/${r.id}` })), ...i.deadlines.filter(d => d.customerActionable && d.status === 'OPEN').map(d => ({ id: d.id, label: d.customerLabel || 'Your broker needs information', dueAt: d.dueAt, href: `/shipments/${i.id}` }))];
    const eta = { current: i.eta?.current ?? i.estimatedArrival, previous: i.eta?.previous ?? null, changedOn: i.eta?.changedOn ?? null, reason: i.eta?.reasonCode ? ({ PORT_CONGESTION: 'Port congestion', WEATHER: 'Weather delay', CARRIER_DELAY: 'Carrier schedule changed', SCHEDULE_CHANGE: 'Schedule changed' }[i.eta.reasonCode] ?? 'Arrival estimate updated') : null, confidence: i.eta?.confidence ?? null };
    const holds = i.holds.filter(h => !['closed', 'released', 'resolved'].includes(h.status.toLowerCase()));
    const references = i.referenceNumbers.map(r => ({ label: r.label, value: r.value }));
    const milestones = i.milestones.map(m => ({ label: m.label, at: m.at, location: m.location }));
    const common = { updatedAt: i.generatedAt, askHref: `/shipments/${i.id}` };
    const cards: AnswerCard[] = [
        { key: 'location', question: 'Where is my shipment?', answer: milestones[0] ? `${milestones[0].label}${milestones[0].location ? ` at ${milestones[0].location}` : ''}.` : i.transportationStatus, status: milestones.length ? 'OK' : 'UNKNOWN', facts: i.carrierName ? [{ label: 'Carrier', value: i.carrierName }] : [], ...common },
        { key: 'eta', question: 'When will it arrive?', answer: eta.current ? `Current arrival estimate: ${eta.current.slice(0, 10)}.` : 'An arrival estimate has not been provided.', status: eta.current ? (i.promiseState === 'AT_RISK' || i.promiseState === 'MISSED' ? 'ATTENTION' : 'OK') : 'UNKNOWN', facts: eta.previous ? [{ label: 'Previous estimate', value: eta.previous.slice(0, 10) }] : [], ...common },
        { key: 'clearance', question: 'When will it clear customs?', answer: holds.length ? `${[...new Set(holds.map(h => h.agencyCode))].join(', ')} review is in progress. Clearance timing is not confirmed.` : i.customsStatus === 'Released' ? 'Customs has released this shipment.' : 'Clearance timing is not confirmed. Your broker will update you when customs responds.', status: holds.length ? 'ATTENTION' : i.customsStatus === 'Released' ? 'OK' : 'UNKNOWN', facts: [{ label: 'Customs', value: i.customsStatus }], ...common },
        { key: 'cost', question: 'What will it cost?', answer: total === null ? 'Your broker has not published cost information yet.' : `${partial ? 'Known charges so far' : 'Estimated duty, fees, and broker charges'}: $${total.toFixed(2)} USD.`, status: partial ? 'UNKNOWN' : 'OK', facts: invoices.map(v => ({ label: `Invoice ${v.number}`, value: `${v.total.toFixed(2)} ${v.currency}`, href: `/invoices` })), ...common },
        { key: 'needs', question: 'What do you need from me?', answer: needs.length ? `${needs.length} item${needs.length === 1 ? '' : 's'} need your attention.` : 'No open customer actions are recorded.', status: needs.length ? 'ACTION_REQUIRED' : 'OK', facts: needs.map(n => ({ label: n.label, value: n.dueAt ? `Due ${n.dueAt.slice(0, 10)}` : 'Open', href: n.href })), ...common },
        { key: 'references', question: 'What are my reference numbers?', answer: references.length ? 'Use these references when contacting your broker or carrier.' : 'Reference numbers have not been provided.', status: references.length ? 'OK' : 'UNKNOWN', facts: references, ...common },
    ];
    if (i.lastFreeDay)
        cards.push({ key: 'free-time', question: 'When does free time end?', answer: `Last free day: ${i.lastFreeDay.slice(0, 10)}.`, status: new Date(i.lastFreeDay).getTime() - new Date(i.generatedAt).getTime() < 48 * 3600000 ? 'ATTENTION' : 'OK', facts: i.demurrageExposureUsd !== null ? [{ label: 'Estimated demurrage exposure', value: `$${i.demurrageExposureUsd.toFixed(2)} USD` }] : [], ...common });
    return { shipmentId: i.id, shipmentNumber: i.shipmentNumber, generatedAt: i.generatedAt, headline: { transportationStatus: i.transportationStatus, customsStatus: i.customsStatus, promiseState: i.promiseState, healthLabel: i.healthLabel }, eta, cost: { dutyAndFeesUsd: duty, brokerChargesUsd: broker, estimatedTotalUsd: total, costIsPartial: partial, invoices }, cards, milestones, referenceNumbers: references, needsFromYou: needs };
}
