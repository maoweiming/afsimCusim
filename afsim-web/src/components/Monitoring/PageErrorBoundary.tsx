import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';
import { useErrorStore } from '../../store/errorStore';

interface PageErrorBoundaryProps {
  children: ReactNode;
  page: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PageErrorBoundary:${this.props.page}]`, error, errorInfo);

    useErrorStore.getState().addError({
      source: 'render',
      severity: 'critical',
      message: `[${this.props.page}] ${error.message}`,
      detail: errorInfo.componentStack ?? undefined,
      stack: error.stack,
      context: { page: this.props.page },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={`${this.props.page} 页面出错`}
          subTitle={this.state.error?.message || '发生了未知错误'}
          extra={
            <Button type="primary" onClick={this.handleReset}>
              重试
            </Button>
          }
          style={{ marginTop: 80 }}
        />
      );
    }

    return this.props.children;
  }
}
