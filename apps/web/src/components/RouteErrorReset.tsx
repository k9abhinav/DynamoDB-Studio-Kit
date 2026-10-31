import { Component, type ReactNode } from "react";
import { ErrorState } from "./ErrorState.js";

interface State {
  error: Error | null;
}

export class RouteErrorReset extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }
    return (
      <div className="bg-bg p-6">
        <ErrorState
          message="This screen hit a problem."
          details={this.state.error.message}
          onRetry={() => {
            this.setState({ error: null });
          }}
        />
      </div>
    );
  }
}
