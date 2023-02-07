import app from "./app";
import http from "http";
import { Server, Socket } from "socket.io";
import googleRoutes from "./routes/googleRoutes";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT"],
  },
});

let roomfull: boolean = true;
let publicRoomSpace: number = 0;
let roomNumber: number = 0;

io.on("connection", (socket) => {
  console.log("User Connected: " + socket.id);

  socket.on("join_game_room", async (data) => {
    const room = data.toString();
    socket.join(room);
    console.log(socket.id, "joined room: ", room);

    //fetches all socket ids in the room:
    const socketsInRoom: any = await io.sockets.adapter.rooms.get(`${room}`);
    console.log(`guests in room ${room}`, socketsInRoom);
    const socketIds = Array.from(socketsInRoom);

    io.in(`${room}`).emit("receive_client_joined", socketIds);
    // socket.emit("room_and_users", [room, socketIds]);
  });

  socket.on("send_team", (data) => {
    console.log(data)
    socket.to(data.tempMyTeam.players.x).emit("receive_my_team", data.tempMyTeam);
    io.in(data.gameId).emit("receive_team_added", data.tempMyTeam);
  });

  socket.on("kart_update", (data) => {
    const gameId = data.gameId;
    const teamId = data.tempTeamId;
    const kart = data.tempKart;
    socket.to(`${gameId}`).emit("receive_kart_update", {kart, teamId});
  });

  socket.on("toggle_player_control", (data) => {
    socket.to(data).emit("receive_toggle_player_control");
  })

  socket.on("send_message", (data) => {
    socket.broadcast.emit("receive_message", data);
  });

  socket.on("disconnect", (reason) => {
    console.log(socket.id + " disconnected");
  });
});

server.listen(3001, () =>
  console.log("Server ready at: http://localhost:3001")
);

export default io;
