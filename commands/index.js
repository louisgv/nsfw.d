import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { Text, Color, Box } from "ink";

import uWS from "uWebSockets.js";

import watcher from "nsfw";
import http from "http";
import handler from "serve-handler";

import fs from "fs-extra";
import path from "path";
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

/// 🚀 Instance file watcher socket daemon.
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
				`File available at http://${networkAddress}:${staticPort} `
			);
		});

		// console.log(pty);

		uWS
			.App()
			.ws("/watch", {
				compresson: 0,
				maxPayloadLength: 16 * 1024 * 1024,

				message: async (ws, message) => {
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
				}
			})

			// .ws("/terminal", {
			// 	compression: 0,
			// 	maxPayloadLength: 16 * 1024 * 1024,
			// 	open: (ws, req) => {
			// 		// For all shell data send it to the websocket
			// 		// setSocketStatus(data);x
			// 		shell.on("data", data => {
			// 			try {
			// 				ws.send(data);
			// 			} catch (error) {
			// 				setSocketStatus(error.message);
			// 			}
			// 		});
			// 	},

			// 	message: (ws, msg, isBinary) => {
			// 		// setSocketStatus(msg);
			// 		if (msg) {
			// 			shell.write(Buffer.from(msg).toString());
			// 		}
			// 	}
			// })
			.listen("0.0.0.0", webSocketPort, token => {
				if (!token) {
					setSocketStatus(
						"💀\tFailed to listen to port " + webSocketPort,
						"red"
					);
					process.exit(1);
				}

				setSocketStatus("🚀\tReady to receive data . . .", "green");
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

Main.positionalArgs = ["path"];

export default Main;
