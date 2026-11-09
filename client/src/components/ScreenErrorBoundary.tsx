import { Component } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
}

interface ScreenErrorBoundaryState {
  error: Error | null;
}

// A screen that throws shows this instead of blanking the whole app; the menu and header keep working.
// Give it key={location} so moving to another screen clears the error.
export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  state: ScreenErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Screen failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="w-full flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2 items-center">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h1 className="text-lg font-semibold">This screen couldn't be shown</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Something went wrong while showing it. Nothing you've saved is affected.
            </p>
            <p className="mt-2 text-xs text-muted-foreground break-words" data-testid="text-screen-error">
              {this.state.error.message}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => this.setState({ error: null })} data-testid="button-screen-retry">
                Try again
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/app">Back to overview</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
