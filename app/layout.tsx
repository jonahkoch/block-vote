import type { Metadata } from "next";
import "./globals.css";
import "./terminal.css";
import { CardanoProvider } from "@/components/MeshProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TransactionLibraryProvider } from "@/components/TransactionLibraryProvider";
import { WalletDrawer } from "@/components/WalletDrawer";
import { PactDrawerButton } from "@/components/PactDrawerButton";
import { LibraryToggle } from "@/components/LibraryToggle";
import { NavigationMenu } from "@/components/NavigationMenu";

export const metadata: Metadata = {
  title: "blockVote - Cardano Governance Voting",
  description: "Collective accountability for Cardano Governance through fractionalized voting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <CardanoProvider>
            <TransactionLibraryProvider>
              <WalletDrawer />
              <PactDrawerButton />

              {/* Desktop: Show individual buttons, Mobile: Show hamburger menu */}
              <div className="hidden md:block">
                <LibraryToggle />
              </div>
              <NavigationMenu />

              {children}
            </TransactionLibraryProvider>
          </CardanoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
