import { Component, ErrorInfo, ReactNode } from 'react';
import ErrorPage from '../pages/error-page';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) return <ErrorPage onReset={this.reset} />;
    return this.props.children;
  }
}
