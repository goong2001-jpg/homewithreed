import { useRef, useState } from 'react';
import { PracticalQuestion, SUBJECTS, WrittenQuestion } from '../data/types';
import {
  addCustomPractical,
  addCustomWritten,
  exportCustomJson,
  IMPORT_TEMPLATE,
  loadCustomPractical,
  loadCustomWritten,
  parseImportJson,
  removeCustomPractical,
  removeCustomWritten,
  saveImportResult,
} from '../data/questionBank';

interface Props {
  onExit: () => void;
}

type Tab = 'written' | 'practical';

const EMPTY_WRITTEN = {
  subject: SUBJECTS[0] as string,
  question: '',
  choices: ['', '', '', ''],
  answer: 0,
  explanation: '',
};

const EMPTY_PRACTICAL = { category: '', question: '', answer: '', explanation: '' };

export default function QuestionManager({ onExit }: Props) {
  const [tab, setTab] = useState<Tab>('written');
  const [customWritten, setCustomWritten] = useState<WrittenQuestion[]>(loadCustomWritten);
  const [customPractical, setCustomPractical] = useState<PracticalQuestion[]>(loadCustomPractical);
  const [writtenForm, setWrittenForm] = useState(EMPTY_WRITTEN);
  const [practicalForm, setPracticalForm] = useState(EMPTY_PRACTICAL);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setCustomWritten(loadCustomWritten());
    setCustomPractical(loadCustomPractical());
  };

  const submitWritten = () => {
    const question = writtenForm.question.trim();
    const choices = writtenForm.choices.map((c) => c.trim());
    if (!question) return setMessage({ ok: false, text: '문제 내용을 입력해 주세요.' });
    if (choices.some((c) => !c))
      return setMessage({ ok: false, text: '보기 4개를 모두 입력해 주세요.' });
    addCustomWritten({
      subject: writtenForm.subject as WrittenQuestion['subject'],
      question,
      choices,
      answer: writtenForm.answer,
      explanation: writtenForm.explanation.trim() || '(해설 없음)',
    });
    setWrittenForm({ ...EMPTY_WRITTEN, subject: writtenForm.subject });
    refresh();
    setMessage({ ok: true, text: '필기 문제가 추가되었습니다. CBT 모의고사 출제 범위에 포함됩니다.' });
  };

  const submitPractical = () => {
    const question = practicalForm.question.trim();
    const answer = practicalForm.answer.trim();
    if (!question) return setMessage({ ok: false, text: '문제 내용을 입력해 주세요.' });
    if (!answer) return setMessage({ ok: false, text: '정답을 입력해 주세요.' });
    addCustomPractical({
      category: practicalForm.category.trim() || '기타',
      question,
      answer,
      ...(practicalForm.explanation.trim() ? { explanation: practicalForm.explanation.trim() } : {}),
    });
    setPracticalForm(EMPTY_PRACTICAL);
    refresh();
    setMessage({ ok: true, text: '실기 문제가 추가되었습니다. 실기 필답형 카드에 포함됩니다.' });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImportJson(String(reader.result ?? ''));
      saveImportResult(result);
      refresh();
      const added = result.written.length + result.practical.length;
      if (result.errors.length === 0) {
        setMessage({
          ok: true,
          text: `업로드 완료: 필기 ${result.written.length}문제, 실기 ${result.practical.length}문제가 추가되었습니다.`,
        });
      } else {
        setMessage({
          ok: added > 0,
          text:
            `${added > 0 ? `${added}문제 추가됨. ` : ''}건너뛴 항목:\n` +
            result.errors.join('\n'),
        });
      }
    };
    reader.readAsText(file);
  };

  const download = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="list-toolbar">
        <span className="section-title" style={{ margin: 0 }}>
          문제 추가/관리
        </span>
        <button className="btn secondary" onClick={onExit}>
          홈으로
        </button>
      </div>

      {/* JSON 업로드 */}
      <div className="manager-box">
        <h3>📂 기출문제 파일 업로드 (JSON)</h3>
        <p className="hint">
          구한 기출문제를 아래 템플릿과 같은 JSON 형식으로 만들어 업로드하면 한 번에 여러 문제를
          추가할 수 있습니다. 기출문제 텍스트를 ChatGPT나 Claude에게 붙여넣고 &ldquo;이 형식의
          JSON으로 변환해줘&rdquo;라고 템플릿과 함께 요청하면 쉽게 만들 수 있어요.
        </p>
        <div className="manager-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            JSON 파일 선택
          </button>
          <button className="btn secondary" onClick={() => setShowTemplate((v) => !v)}>
            {showTemplate ? '템플릿 닫기' : '템플릿 예시 보기'}
          </button>
          <button
            className="btn secondary"
            onClick={() => download('safety-exam-template.json', IMPORT_TEMPLATE)}
          >
            템플릿 다운로드
          </button>
          {(customWritten.length > 0 || customPractical.length > 0) && (
            <button
              className="btn secondary"
              onClick={() => download('safety-exam-my-questions.json', exportCustomJson())}
            >
              내 문제 백업(내보내기)
            </button>
          )}
        </div>
        {showTemplate && <pre className="template-pre">{IMPORT_TEMPLATE}</pre>}
      </div>

      {message && (
        <div className={`import-message ${message.ok ? 'ok' : 'error'}`}>{message.text}</div>
      )}

      {/* 직접 입력 */}
      <div className="manager-box">
        <h3>✏️ 직접 입력</h3>
        <div className="chip-row" style={{ marginBottom: 12 }}>
          <button
            className={`chip ${tab === 'written' ? 'active' : ''}`}
            onClick={() => setTab('written')}
          >
            필기 (객관식)
          </button>
          <button
            className={`chip ${tab === 'practical' ? 'active' : ''}`}
            onClick={() => setTab('practical')}
          >
            실기 (필답형)
          </button>
        </div>

        {tab === 'written' ? (
          <div className="form-grid">
            <label>
              과목
              <select
                value={writtenForm.subject}
                onChange={(e) => setWrittenForm({ ...writtenForm, subject: e.target.value })}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              문제
              <textarea
                rows={3}
                value={writtenForm.question}
                placeholder="문제 내용을 입력하세요"
                onChange={(e) => setWrittenForm({ ...writtenForm, question: e.target.value })}
              />
            </label>
            {writtenForm.choices.map((choice, i) => (
              <label key={i} className="choice-input">
                <input
                  type="radio"
                  name="answer"
                  checked={writtenForm.answer === i}
                  onChange={() => setWrittenForm({ ...writtenForm, answer: i })}
                  title="정답으로 선택"
                />
                <input
                  type="text"
                  value={choice}
                  placeholder={`보기 ${i + 1}${writtenForm.answer === i ? ' (정답)' : ''}`}
                  onChange={(e) => {
                    const choices = [...writtenForm.choices];
                    choices[i] = e.target.value;
                    setWrittenForm({ ...writtenForm, choices });
                  }}
                />
              </label>
            ))}
            <p className="hint">왼쪽 라디오 버튼으로 정답 보기를 선택하세요.</p>
            <label>
              해설 (선택)
              <textarea
                rows={2}
                value={writtenForm.explanation}
                placeholder="해설을 입력하세요"
                onChange={(e) => setWrittenForm({ ...writtenForm, explanation: e.target.value })}
              />
            </label>
            <button className="btn" onClick={submitWritten}>
              필기 문제 추가
            </button>
          </div>
        ) : (
          <div className="form-grid">
            <label>
              카테고리
              <input
                type="text"
                value={practicalForm.category}
                placeholder="예: 안전관리론, 기계안전 (비워두면 '기타')"
                onChange={(e) => setPracticalForm({ ...practicalForm, category: e.target.value })}
              />
            </label>
            <label>
              문제
              <textarea
                rows={3}
                value={practicalForm.question}
                placeholder="필답형 문제 내용을 입력하세요"
                onChange={(e) => setPracticalForm({ ...practicalForm, question: e.target.value })}
              />
            </label>
            <label>
              정답
              <textarea
                rows={3}
                value={practicalForm.answer}
                placeholder="모범답안을 입력하세요"
                onChange={(e) => setPracticalForm({ ...practicalForm, answer: e.target.value })}
              />
            </label>
            <label>
              해설 (선택)
              <textarea
                rows={2}
                value={practicalForm.explanation}
                placeholder="해설을 입력하세요"
                onChange={(e) =>
                  setPracticalForm({ ...practicalForm, explanation: e.target.value })
                }
              />
            </label>
            <button className="btn" onClick={submitPractical}>
              실기 문제 추가
            </button>
          </div>
        )}
      </div>

      {/* 내 문제 목록 */}
      <div className="manager-box">
        <h3>
          📚 내가 추가한 문제 (필기 {customWritten.length} · 실기 {customPractical.length})
        </h3>
        {customWritten.length === 0 && customPractical.length === 0 && (
          <p className="hint">아직 추가한 문제가 없습니다.</p>
        )}
        {customWritten.map((q) => (
          <div key={q.id} className="custom-item">
            <div>
              <span className="tag">필기 · {q.subject}</span>
              <p>{q.question}</p>
              <p className="hint">정답: {q.answer + 1}번 — {q.choices[q.answer]}</p>
            </div>
            <button
              className="btn danger"
              onClick={() => {
                removeCustomWritten(q.id);
                refresh();
              }}
            >
              삭제
            </button>
          </div>
        ))}
        {customPractical.map((q) => (
          <div key={q.id} className="custom-item">
            <div>
              <span className="tag">실기 · {q.category}</span>
              <p>{q.question}</p>
              <p className="hint">정답: {q.answer}</p>
            </div>
            <button
              className="btn danger"
              onClick={() => {
                removeCustomPractical(q.id);
                refresh();
              }}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
