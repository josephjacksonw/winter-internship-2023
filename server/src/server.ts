import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { getGameById } from "./Models/game";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://super-pacart.netlify.app",
      "https://super-pacart.fly.dev",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  },
});

io.on("connection", (socket) => {
  console.log("User Connected: " + socket.id);

  socket.on("join_game_room", async (data) => {
    const { gameId, userId } = data;
    console.log("gameId " + gameId);
    console.log("userId " + userId);

    const room = gameId.toString();
    socket.join(room);
    console.log(socket.id, "joined room: ", room);

    const gameData = JSON.stringify(await getGameById(room));
    io.to(socket.id).emit("receive_initial_game_data", gameData);

    const socketsInRoom: any = await io.sockets.adapter.rooms.get(`${room}`);
    console.log(`guests in room ${room}`, socketsInRoom);
    const socketIds = Array.from(socketsInRoom);

    //database fetch game boundaries/pellets/spawnpoints arrays
    io.in(`${room}`).emit("receive_client_joined", {socketIds, userId});//send map properties from the database
  });

  socket.on("send_team", (data) => {
    const { jsonTeam, jsonKart } = data;
    io.in(data.gameId).emit("receive_team_added", { jsonTeam, jsonKart });
  });

  socket.on("game_update", (data) => {
    const { gameId, tempColor, tempScore, jsonKart } = data;
    socket
      .to(`${gameId}`)
      .emit("receive_game_update", { tempColor, jsonKart, tempScore });
  });

  socket.on("toggle_player_control", (data) => {
    socket
      .to(data.tempTeamMate)
      .emit("receive_toggle_player_control", data.jsonTeam);
  });

  socket.on("remove_pellet", (data) => {
    const { gameId, i, isGameActive  } = data;
    socket.to(gameId).emit("pellet_gone", { i, isGameActive });
  });

  //potential
  // socket.on("leave_room", async ({ roomId, userId }) => {
  //   socket.leave(roomId);
  //   const socketsInRoom: any = await io.sockets.adapter.rooms.get(`${roomId}`);
  //   console.log(`updated guests in room: ${roomId}`, socketsInRoom);
  //   const usersInRoom = Array.from(socketsInRoom);

  //   socket.to(roomId).emit("update_user_list", { usersInRoom });
  // });

  socket.on("disconnect", (reason) => {
    console.log(socket.id + " disconnected");
  });

  socket.on("db_update", (data) => {
    const { gameId, currentTeamId, currentScore, currentKart, currentPellets, currentIsGameOver } = data;
  
    const gameUpdatesOnInterval = async () => {
      await prisma.game.update({
        where: { id: parseInt(gameId) },
        data: { 
          pellets: currentPellets,
          isActive: currentIsGameOver
        },
      }), 
      await prisma.team.update({
          where: { id: parseInt(currentTeamId) },
          data: { 
            score: currentScore,
            position:  currentKart["position"],
            velocity:  currentKart["velocity"],
            angle: Math.round(currentKart["angle"])
          },
        })
    }
   //only 1 player per Team has an existing currentTeamId
    if (currentTeamId) {
      console.count("db_update2");
      gameUpdatesOnInterval();
    }
  
    console.count("db_update");
  })
});

server.listen(3001, () =>
  console.log("Server ready at: http://localhost:3001")
);
// server.listen(8080, () =>
//   console.log("Server ready at: 8080")
// );


export default io;
