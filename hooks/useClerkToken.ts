import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef } from "react";

export function useClerkToken() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  return useCallback(() => getTokenRef.current(), []);
}
