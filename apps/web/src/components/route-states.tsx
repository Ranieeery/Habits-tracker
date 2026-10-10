import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";
import { ErrorState, Spinner } from "./states.tsx";

export function RootLayout() {
	return (
		<>
			<Outlet />
			<Toaster position="top-center" />
		</>
	);
}

export function PendingPage() {
	return (
		<div className="flex min-h-dvh items-center justify-center">
			<Spinner />
		</div>
	);
}

export function RouteError({ error }: { error: unknown }) {
	const router = useRouter();
	return (
		<div className="mx-auto flex min-h-dvh max-w-md items-center px-4">
			<ErrorState
				className="w-full"
				error={error}
				onRetry={() => void router.invalidate()}
			/>
		</div>
	);
}

export function NotFoundPage() {
	return (
		<div className="flex flex-col items-start gap-4 py-10">
			<h1 className="text-3xl font-extrabold">Página não encontrada</h1>
			<p className="text-muted">O endereço não existe ou a data é inválida.</p>
			<Link to="/" className={buttonVariants({ variant: "secondary" })}>
				Ir para o histórico
			</Link>
		</div>
	);
}
