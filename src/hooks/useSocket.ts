"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const useSocket = () => {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!socket) {
            socket = io();
        }

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        setConnected(socket.connected);

        return () => {
            socket?.off("connect", onConnect);
            socket?.off("disconnect", onDisconnect);
        };
    }, []);

    return { socket, connected };
};
