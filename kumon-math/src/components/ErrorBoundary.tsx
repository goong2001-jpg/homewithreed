import React from 'react';

interface State { hasError: boolean; }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg, #ffecd2 0%, #fcb69f 40%, #c3cfe2 100%)',
          fontFamily: "'Nunito', sans-serif",
          gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 60 }}>😢</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2c3e50' }}>앗, 오류가 났어요!</div>
          <div style={{ fontSize: 14, color: '#888' }}>아래 버튼을 눌러서 다시 시작해보세요</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              color: 'white', border: 'none', borderRadius: 14,
              padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            다시 시작하기 🔄
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
