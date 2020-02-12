import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { Text, Color, Box } from "ink";

import watcher from "nsfw";
import http from "http";
import handler from "serve-handler";
import url from "url";

import fs from "fs-extra";
import path from "path";

import WebSocket from "ws";

import { useLogState, getNetworkAddress } from "../core/utils";
import { webSocketPort, staticPort } from "../core/config";

import uuid from "uuid/v1";

// import os from "os";
// import { spawn } from "node-pty";

// const shellCmd = os.platform() === "win32" ? "powershell.exe" : "bash";

const watchMap = new Map();

// const shell = spawn(shellCmd, [], {
// 	name: "xterm-color",
// 	cwd: process.env.PWD,
// 	env: process.env,
// 	encoding: null
// });

/// 🚀 Instant file watcher socket daemon for armhf.
const Main = ({ path: watchPath }) => {
	const [restStatus, restStatusColor, setRestStatus] = useLogState(
		"rest",
		"🔄\tSpinning up file server . . .",
		"yellow"
	);

	const [socketStatus, socketStatusColor, setSocketStatus] = useLogState(
		"socket",
		"🔄\tSpinning up socket server . . .",
		"yellow"
	);

	const [watcherStatus, watcherStatusColor, setWatcherStatus] = useLogState(
		"watcher",
		"🔄\tPrepare watch path . . .",
		"yellow"
	);

	useEffect(() => {
		const absoluteWatchPath = path.join(process.env.PWD, watchPath);
		if (!fs.pathExistsSync(absoluteWatchPath)) {
			setSocketStatus("⛔\tShutdown all services", "red");
			setRestStatus("⛔\tError!", "red");
			setWatcherStatus(`⛔\t${absoluteWatchPath} does not exist`, "red");
			return;
		}

		const networkAddress = getNetworkAddress();

		const server = new http.Server((req, res) => {
			return handler(req, res, {
				public: absoluteWatchPath
			});
		});

		server.listen(staticPort, "0.0.0.0", () => {
			setRestStatus(
				`🚀\tFile ready at http://${networkAddress}:${staticPort} `,
				"green"
			);
		});

		// console.log(pty);

		const socketServer = new http.Server();
		const wss1 = new WebSocket.Server({ noServer: true });

		wss1.on("connection", function connection(ws) {
			ws.on("message", async function incoming(message) {
				try {
					const data = Buffer.from(message).toString();
					// setSocketStatus(data);

					const args = JSON.parse(data);
					const { action, payload } = args;

					switch (action) {
						case "start": {
							const watchId = uuid();

							const progressWatcher = await watcher(absoluteWatchPath, data => {
								ws.send(
									JSON.stringify({
										watchId,
										type: "watch-data",
										data,
										success: true
									})
								);
							});

							await progressWatcher.start();

							watchMap.set(watchId, progressWatcher);
							setWatcherStatus(
								`👁️\tWatching ${absoluteWatchPath} with id: ${watchId} `
							);
							break;
						}
						case "stop": {
							const { watchId: stopWatchId } = payload;
							if (!watchMap.has(stopWatchId)) return;
							// console.log(watchMap);

							await watchMap.get(stopWatchId).stop();

							watchMap.delete(stopWatchId);

							ws.send(
								JSON.stringify({
									success: true,
									type: "watch-stop",
									watchId: stopWatchId
								})
							);
							break;
						}
						default:
							break;
					}
				} catch (error) {
					setWatcherStatus(`E\t${error.message}`, 'red')
				}
			});
		});

		socketServer.on("upgrade", function upgrade(request, socket, head) {
			const pathname = url.parse(request.url).pathname;

			if (pathname === "/watch") {
				wss1.handleUpgrade(request, socket, head, function done(ws) {
					wss1.emit("connection", ws, request);
				});
			}
		});

		socketServer.listen(webSocketPort, "0.0.0.0", () => {
			setSocketStatus(
				`🚀\tSocket ready at ws://${networkAddress}:${webSocketPort} `,
				"green"
			);
		});

		process.on("SIGINT", () => {
			setRestStatus("⏹️\tShutdown app server", "cyan");
			setSocketStatus("⏹️\tShutdown socket server", "cyan");
			setWatcherStatus("⏹️\tShutdown file watcher", "cyan");

			process.exit();
		});
	}, []);

	return (
		<Box flexDirection="column">
			<Color keyword={socketStatusColor}>
				<Text>{socketStatus}</Text>;
			</Color>
			<Color keyword={restStatusColor}>
				<Text>{restStatus}</Text>;
			</Color>
			<Color keyword={watcherStatusColor}>
				<Text>{watcherStatus}</Text>;
			</Color>
		</Box>
	);
};

Main.propTypes = {
	/// Relative path to the watching directory
	path: PropTypes.string
};

Main.defaultProps = {
	path: "."
};

Main.shortFlags = {
	path: "p"
};

export default Main;
