import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';
import { useErrorStore } from '../../store/errorStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);

    useErrorStore.getState().addError({
      source: 'render',
      severity: 'critical',
      message: error.message,
      detail: errorInfo.componentStack ?? undefined,
      stack: error.stack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Result
          status="error"
          title="页面出错"
          subTitle={this.state.error?.message || '发生了未知错误'}
          extra={[
            <Button key="retry" type="primary" onClick={this.handleReset}>
              重试
            </Button>,
            <Button key="home" onClick={() => window.location.href = '/portal'}>
              返回首页
            </Button>,
          ]}
          style={{ marginTop: 100 }}
        />
      );
    }

    return this.props.children;
  }
}
