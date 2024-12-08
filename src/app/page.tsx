import { RoundedTool } from "./rounded-tool";
// import { PostTest } from "@/components/PostTest";

export const metadata = {
  title: "Squad Spotify Wrapped",
  description: "Generate your Squad's Spotify Wrapped playlist.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col justify-between p-8 font-[family-name:var(--font-geist-sans)] sm:p-20">
      <main className="flex flex-grow flex-col items-center justify-center">
        {/* <PostTest /> */}
        <div>
          Hi. I&apos;m{" "}
          <a
            href="https://kasralekan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="italic hover:underline"
          >
            Kasra
          </a>
          . I built this because I wanted my friends to experience each
          other&apos;s music. I hope you enjoy it.
        </div>
        
        <div className="mt-4">
          <RoundedTool />
        </div>
      </main>
      <footer className="mt-8 text-center text-sm text-gray-500">
        <a
          href="https://github.com/anrath/SquadSpotifyWrapped"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
}
