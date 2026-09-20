'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Download,
  ExternalLink,
  FlaskConical,
  KeyRound,
  Layers2,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Terminal,
  TriangleAlert,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { scenarios, getSource, type ScenarioId } from '@/lib/scenarios';
import { getComparisonView } from '@/lib/comparison-view';
import {
  buildJevRequest,
  getAssessment,
  questionLabels,
  answerLabels,
  type Analysis,
} from '@/lib/jev';

export default function UpgradeLab() {
  const [selected, setSelected] = useState<ScenarioId>('profile');
  const [guarded, setGuarded] = useState(false);
  const [tab, setTab] = useState<'behavior' | 'code'>('behavior');
  const [keyDialog, setKeyDialog] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inputText, setInputText] = useState('{}');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const requestCounter = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const scenario = scenarios.find((item) => item.id === selected)!;
  const safe = selected === 'profile' && guarded;
  const comparison = useMemo(
    () => getComparisonView(selected, inputText, guarded),
    [selected, guarded, inputText],
  );
  const result = comparison.result;
  const assessment = analysis ? getAssessment(analysis) : null;

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  function clearAnalysis() {
    requestCounter.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setAnalysis(null);
    setError('');
    setExportMessage('');
  }
  function selectScenario(id: ScenarioId) {
    clearAnalysis();
    setSelected(id);
    setGuarded(false);
    setInputText(scenarios.find((item) => item.id === id)!.input);
    setEditing(false);
  }
  async function analyze(key = apiKey) {
    if (!key.trim()) {
      setKeyDialog(true);
      return;
    }
    if (!result) return;
    controller.current?.abort();
    const current = ++requestCounter.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setAnalysis(null);
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: selected,
          guarded,
          input: comparison.input,
          apiKey: key,
        }),
        signal: abort.signal,
      });
      const data = (await response.json()) as Analysis & { error?: string };
      if (!response.ok)
        throw new Error(
          data.error || 'The analysis could not complete. Please try again.',
        );
      if (data.mode !== 'live' || !data.answers?.impact)
        throw new Error(
          'The response was incomplete. No analysis was substituted.',
        );
      if (current === requestCounter.current) setAnalysis(data);
    } catch (cause) {
      if (current === requestCounter.current)
        setError(
          cause instanceof Error && cause.name === 'AbortError'
            ? 'The request timed out. Please try again.'
            : cause instanceof Error
              ? cause.message
              : 'Unable to complete this analysis.',
        );
    } finally {
      clearTimeout(timeout);
      if (current === requestCounter.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function connectKey() {
    const key = keyDraft.trim();
    if (!key || /[\r\n]/.test(key)) return;
    setApiKey(key);
    setKeyDraft('');
    setKeyDialog(false);
    void analyze(key);
  }
  function exportReport() {
    const report = {
      title: 'Upgrade Lens',
      createdAt: new Date().toISOString(),
      scenario: selected,
      consumer: safe ? 'display with fallback' : 'original consumer',
      source: getSource(selected, guarded),
      input: comparison.input,
      migration: { text: scenario.change, url: scenario.url },
      execution: result,
      assessmentOrigin: analysis
        ? 'Live TypeSafe Jev response'
        : 'No Jev call has been made for this example',
      jev: analysis,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `upgrade-lens-${selected}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage('Report downloaded');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Upgrade Lens home">
          <span className="brand-mark">
            <ScanLine size={23} />
          </span>
          upgrade<span className="brand-light">lens</span>
          <span className="beta">LAB</span>
        </Link>
        <div className="header-links">
          <a href="#how-it-works">
            How it works <ArrowUpRight size={14} />
          </a>
          <span className="header-divider" />
          <span className="powered">
            <span className="status-dot" />
            Built with Jev
          </span>
          <Button
            variant="outline"
            className="key-button"
            onClick={() => setKeyDialog(true)}
          >
            <KeyRound size={15} />
            {apiKey ? 'Key added' : 'Connect Jev'}
          </Button>
        </div>
      </header>
      <main className="main-wrap">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span />
              THE DEPENDENCY UPGRADE LAB
            </div>
            <h1>
              Same code. <span>Different behavior.</span>
            </h1>
            <p>
              See what an upgrade changes. Ask Jev if it matters to your app.
            </p>
          </div>
          <div className="version-path">
            <div className="package-glyph">
              <Layers2 size={21} />
            </div>
            <div>
              <strong>Zod</strong>
              <div className="version-numbers">
                v3 <ArrowRight size={13} /> v4
              </div>
            </div>
            <span className="version-tag">3 real changes</span>
          </div>
        </section>
        <div className="workspace">
          <aside className="scenario-rail">
            <div className="rail-heading">
              <span>EXPLORE A CASE</span>
              <span>01 — 03</span>
            </div>
            <div className="scenario-list">
              {scenarios.map((item, index) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`scenario-button ${selected === item.id ? 'selected' : ''}`}
                  onClick={() => selectScenario(item.id)}
                  aria-pressed={selected === item.id}
                >
                  <span className="case-number">0{index + 1}</span>
                  <span className="case-copy">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </span>
                  <ChevronRight size={15} />
                </Button>
              ))}
            </div>
            <div className="rail-note">
              <FlaskConical size={18} />
              <strong>
                A small experiment.
                <br />A very real problem.
              </strong>
              <p>
                A dependency update can change what your app does, even when the
                code looks the same.
              </p>
              <a
                href="https://zod.dev/v4/changelog"
                target="_blank"
                rel="noreferrer"
              >
                Read the migration guide <ArrowUpRight size={13} />
              </a>
            </div>
            <div className="rail-footer">
              <span className="tiny-square" /> TYPESCRIPT × JEV
            </div>
          </aside>
          <section className="workbench" aria-label="Upgrade comparison">
            <div className="bench-heading">
              <div className="breadcrumb">
                zod migration <ChevronRight size={13} />
                <span>{scenario.file}</span>
              </div>
              <span className="subtle-tag">REAL EXECUTION</span>
            </div>
            <div className="case-heading">
              <span className={`case-icon ${safe ? 'safe' : ''}`}>
                {safe ? <ShieldCheck size={23} /> : <TriangleAlert size={23} />}
              </span>
              <div>
                <h2>
                  {safe ? 'A change without a consequence' : scenario.headline}
                </h2>
                <p>
                  {safe
                    ? 'The fallback keeps the displayed name consistent in both versions.'
                    : scenario.description}
                </p>
              </div>
            </div>
            <div className="bench-toolbar">
              <fieldset className="view-tabs" aria-label="Comparison view">
                <Button
                  variant="ghost"
                  className={tab === 'behavior' ? 'active' : ''}
                  aria-pressed={tab === 'behavior'}
                  onClick={() => setTab('behavior')}
                >
                  <Layers2 size={14} />
                  Before & after
                </Button>
                <Button
                  variant="ghost"
                  className={tab === 'code' ? 'active' : ''}
                  aria-pressed={tab === 'code'}
                  onClick={() => setTab('code')}
                >
                  <Code2 size={15} />
                  The code
                </Button>
              </fieldset>
              {selected === 'profile' && (
                <label className="safe-toggle">
                  <input
                    type="checkbox"
                    checked={guarded}
                    onChange={(event) => {
                      clearAnalysis();
                      setGuarded(event.target.checked);
                    }}
                  />
                  <span className="switch-track" />
                  Try a safe usage
                </label>
              )}
            </div>
            {tab === 'behavior' ? (
              <div className="comparison">
                <div className="input-strip">
                  <span>
                    <Braces size={14} />
                    SAME INPUT
                  </span>
                  <code>
                    {inputText.length < 75 ? inputText : 'Custom JSON input'}
                  </code>
                  <Button
                    variant="ghost"
                    className="edit-input"
                    onClick={() => setEditing(!editing)}
                    aria-expanded={editing}
                  >
                    {editing ? 'Close editor' : 'Edit input'}
                    <Code2 size={12} />
                  </Button>
                </div>
                {editing && (
                  <div className="input-editor">
                    <label htmlFor="example-input">Example input · JSON</label>
                    <Textarea
                      id="example-input"
                      value={inputText}
                      maxLength={4000}
                      spellCheck={false}
                      onChange={(event) => {
                        clearAnalysis();
                        setInputText(event.target.value);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearAnalysis();
                        setInputText(scenario.input);
                      }}
                    >
                      <RotateCcw size={12} />
                      Reset input
                    </Button>
                  </div>
                )}
                {comparison.error ? (
                  <p role="alert" className="error-message">
                    {comparison.error}
                  </p>
                ) : (
                  result && (
                    <div className="version-grid">
                      {(['before', 'after'] as const).map((side, index) => (
                        <div
                          key={side}
                          className={`version-panel ${side} ${side === 'after' && !result.changed ? 'is-safe' : ''}`}
                        >
                          <div className="panel-label">
                            <span className="version-pill">
                              ZOD {index + 3}
                            </span>
                            <span>
                              <span className="small-dot" />
                              {side.toUpperCase()}
                            </span>
                          </div>
                          <div className="output-caption">
                            {scenario.outputLabel}
                          </div>
                          <pre>
                            {JSON.stringify(result[side].output, null, 2)}
                          </pre>
                          <div className="consumer-result">
                            <ArrowDown size={15} />
                            <span>{result[side].outcome}</span>
                            {side === 'after' && result.changed ? (
                              <TriangleAlert size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
                <div className="comparison-note">
                  <CircleHelp size={14} />
                  <span>{comparison.note}</span>
                </div>
              </div>
            ) : (
              <div className="code-surface">
                <div className="code-label">
                  <Terminal size={14} />
                  {scenario.file}
                  <span>TypeScript</span>
                </div>
                <pre>
                  {getSource(selected, guarded)
                    .split('\n')
                    .map((line, index) => (
                      <div className="code-line" key={index}>
                        <span>{index + 1}</span>
                        <code>{line || ' '}</code>
                      </div>
                    ))}
                </pre>
              </div>
            )}
            <div className="migration-note">
              <span className="note-icon">
                <ExternalLink size={15} />
              </span>
              <p>
                <strong>The migration note</strong>
                {scenario.change}
              </p>
              <a
                href={scenario.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Read official migration note"
              >
                <ArrowUpRight size={18} />
              </a>
            </div>
          </section>
        </div>

        <section className="jev-section" aria-label="Jev assessment">
          <div className="jev-intro">
            <div className="jev-symbol">
              <Sparkles size={21} />
            </div>
            <div>
              <div className="eyebrow">THE SEMANTIC CHECK</div>
              <h2>
                A change happened.
                <br />
                Does it matter here?
              </h2>
              <p>
                Jev reads the migration note and your code, then returns
                structured decisions about the impact.
              </p>
            </div>
            <Button
              className="analyze-button"
              disabled={busy || !result}
              onClick={() => void analyze()}
            >
              {busy ? (
                <LoaderCircle className="spinning" size={16} />
              ) : (
                <Sparkles size={16} />
              )}{' '}
              {busy
                ? 'Asking Jev…'
                : analysis
                  ? 'Run Jev again'
                  : 'Analyze with Jev'}
              {!busy && <ArrowRight size={16} />}
            </Button>
            <span className="live-cost-note">
              Live runs use your TypeSafe account.
            </span>
          </div>
          <div
            className={`assessment ${analysis ? 'live-assessment' : ''}`}
            aria-live="polite"
            aria-busy={busy}
          >
            <div className="assessment-header">
              <span className="assessment-label">
                <span className="small-dot" />
                {busy
                  ? 'JEV IS EVALUATING'
                  : assessment
                    ? assessment.label
                    : comparison.label}
              </span>
              <span className={`example-label ${analysis ? 'live-label' : ''}`}>
                {analysis ? 'Live Jev response' : 'Authored guide · no AI call'}
              </span>
            </div>
            {busy ? (
              <div className="analysis-loading">
                <LoaderCircle className="spinning" size={24} />
                <p>
                  Three small questions.
                  <br />
                  <span>One structured assessment.</span>
                </p>
              </div>
            ) : (
              <>
                <h3>{assessment ? assessment.title : comparison.title}</h3>
                <p>
                  {assessment ? assessment.description : comparison.description}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="error-message analysis-error">
                {error}{' '}
                <Button variant="link" onClick={() => setKeyDialog(true)}>
                  Check key
                </Button>
              </p>
            )}
            {analysis && (
              <div className="judgment-grid">
                {(
                  Object.keys(questionLabels) as Array<
                    keyof typeof questionLabels
                  >
                ).map((id) => {
                  const answer = analysis.answers[id];
                  return (
                    <div className="judgment" key={id}>
                      <div>
                        <span>{questionLabels[id]}</span>
                        <strong>{answerLabels[answer.choice]}</strong>
                      </div>
                      <div className="probability-track" aria-hidden="true">
                        <span
                          className="prob-yes"
                          style={{
                            width: `${answer.probabilities.yes * 100}%`,
                          }}
                        />
                        <span
                          className="prob-no"
                          style={{ width: `${answer.probabilities.no * 100}%` }}
                        />
                        <span
                          className="prob-unknown"
                          style={{
                            width: `${answer.probabilities.insufficient_context * 100}%`,
                          }}
                        />
                      </div>
                      <p>
                        Yes {Math.round(answer.probabilities.yes * 100)}% · No{' '}
                        {Math.round(answer.probabilities.no * 100)}% · Unclear{' '}
                        {Math.round(
                          answer.probabilities.insufficient_context * 100,
                        )}
                        %
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            {analysis && (
              <p className="model-note">
                {analysis.model} · {(analysis.elapsedMs / 1000).toFixed(2)}s ·{' '}
                {analysis.usage
                  ? `${analysis.usage.input_tokens.toLocaleString()} input tokens`
                  : 'Usage unavailable'}
                <br />
                Model estimates for this snippet, not a guarantee of
                correctness.
              </p>
            )}
            <div className="assessment-bottom">
              <span>
                <Code2 size={14} />
                {scenario.file}
              </span>
              <Button
                variant="ghost"
                className="export-button"
                disabled={!result || busy}
                onClick={exportReport}
              >
                <Download size={13} />
                {exportMessage || 'Export report'}
              </Button>
            </div>
          </div>
        </section>
        <details className="request-details">
          <summary>
            <Braces size={15} />
            What exactly does Jev see?
            <ChevronRight size={13} />
          </summary>
          <p>
            The code, input, and documented change are sent to TypeSafe. The
            executed answers above are withheld so the assessment is
            independent. All three questions are evaluated against the same
            context. The prose in the guide is authored; Jev returns the
            decisions and probabilities.
          </p>
          {result ? (
            <pre>
              {JSON.stringify(
                buildJevRequest(selected, comparison.input, guarded),
                null,
                2,
              )}
            </pre>
          ) : (
            <p>Enter valid JSON to preview the Jev request.</p>
          )}
        </details>
        <section className="how-section" id="how-it-works">
          <div className="how-heading">
            <span className="eyebrow">UNDER THE LENS</span>
            <h2>One upgrade. Three layers of evidence.</h2>
          </div>
          <div className="how-grid">
            <div>
              <span className="step-number">01</span>
              <h3>Observe the change</h3>
              <p>
                Run the same input through Zod 3 and 4. Change the input to
                explore the boundary.
              </p>
            </div>
            <div>
              <span className="step-number">02</span>
              <h3>Give Jev the context</h3>
              <p>
                The migration note, the example input, and the code that uses
                the result.
              </p>
            </div>
            <div>
              <span className="step-number">03</span>
              <h3>Inspect the judgment</h3>
              <p>
                Compare typed decisions and probabilities with the actual
                behavior.
              </p>
            </div>
          </div>
        </section>
        <footer>
          <span className="footer-brand">
            <ScanLine size={16} />
            upgrade lens
          </span>
          <p>A focused demo. Three examples, one useful question.</p>
          <a
            href="https://docs.typesafe.ai/introduction"
            target="_blank"
            rel="noreferrer"
          >
            Powered by TypeSafe Jev <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
      <Dialog
        open={keyDialog}
        onOpenChange={(open) => {
          setKeyDialog(open);
          if (!open) setKeyDraft('');
        }}
      >
        <DialogContent className="connection-dialog">
          <span className="dialog-symbol">
            <KeyRound size={23} />
          </span>
          <DialogTitle>Bring Jev into the loop.</DialogTitle>
          <DialogDescription>
            Your key is used for this request to TypeSafe. This app keeps it in
            memory, never in browser storage or reports. Refreshing clears it.
          </DialogDescription>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              connectKey();
            }}
            className="key-form"
          >
            <label htmlFor="api-key" className="field-label">
              TypeSafe API key
            </label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              maxLength={512}
              placeholder="Paste your API key"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <Button
              type="submit"
              disabled={!keyDraft.trim() || /[\r\n]/.test(keyDraft) || !result}
              className="connect-submit"
            >
              Connect & analyze <ArrowRight size={16} />
            </Button>
          </form>
          {apiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                clearAnalysis();
                setApiKey('');
                setKeyDraft('');
                setKeyDialog(false);
              }}
            >
              <Unplug size={14} />
              Forget current key
            </Button>
          )}
          <a
            href="https://console.typesafe.ai/"
            target="_blank"
            rel="noreferrer"
            className="get-key"
          >
            Get a key from TypeSafe <ArrowUpRight size={14} />
          </a>
          <p className="key-disclosure">
            Only the displayed example is submitted. Live requests are billed by
            TypeSafe to your account.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
