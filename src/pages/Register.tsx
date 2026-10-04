import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPublishedSignupPage } from "@/lib/platformSignupPage";
import { defaultSignupContent } from "@/lib/platformSignupContent";
import PlatformSignupView from "@/components/PlatformSignupView";

export default function Register() {
  const { data: content = defaultSignupContent } = useQuery({
    queryKey: ["platform-signup-published"], queryFn: fetchPublishedSignupPage, staleTime: 30_000,
  });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${content.ctaText} | ${content.brandName}`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) description.content = content.description;
    return () => { document.title = previousTitle; if (description) description.content = previousDescription || ""; };
  }, [content]);
  return <PlatformSignupView content={content} />;
}
