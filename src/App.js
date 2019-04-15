import React, { Component } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  YellowBox,
  TextInput,
}                           from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  MediaStreamTrack,
  RTCView,
  mediaDevices,
}                           from 'react-native-webrtc';
import io                   from "socket.io-client";
import s                    from './style';


YellowBox.ignoreWarnings(['Setting a timer', 'Unrecognized WebSocket connection', 'ListView is deprecated and will be removed']);

const url = 'https://be125cfe.ngrok.io/';
const socket = io.connect(url, { transports: ["websocket"] });
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  //sdpSemantics: 'unified-plan',
};
const pcPeers = {};
let container;
let localStream;

const join = roomID => {
  //console.log("join");
  socket.emit("join", roomID, function (socketIds) {
    //console.log("join", socketIds);
    for (const i in socketIds) {
      const socketId = socketIds[i];
      createPC(socketId, true);
    }
  });
};

function createPC(socketId, isOffer) {
  const pc = new RTCPeerConnection(configuration);
  pcPeers[socketId] = pc;
  
  pc.onicecandidate = function (event) {
    //console.log("onicecandidate", event.candidate);
    if (event.candidate) {
      socket.emit("exchange", { to: socketId, candidate: event.candidate });
    }
  };
  
  function createOffer() {
    pc.createOffer(function (desc) {
      //console.log("createOffer", desc);
      pc.setLocalDescription(
        desc,
        function () {
          //console.log("setLocalDescription", pc.localDescription);
          socket.emit("exchange", { to: socketId, sdp: pc.localDescription });
        },
        logError,
      );
    }, logError);
  }
  
  pc.onnegotiationneeded = function () {
    //console.log("onnegotiationneeded");
    if (isOffer) {
      createOffer();
    }
  };
  
  pc.oniceconnectionstatechange = function (event) {
    //console.log("oniceconnectionstatechange", event.target.iceConnectionState);
    if (event.target.iceConnectionState === "completed") {
      setTimeout(() => {
        getStats();
      }, 1000);
    }
    if (event.target.iceConnectionState === "connected") {
      createDataChannel();
    }
  };
  pc.onsignalingstatechange = function (event) {
    //console.log("onsignalingstatechange", event.target.signalingState);
  };
  
  pc.onaddstream = function (event) {
    //console.log("onaddstream", event.stream);
    container.setState({ info: "One peer join!" });
    
    const remoteList = container.state.remoteList;
    
    console.log("\n\n\nHERE");
    console.log(event.stream);
    console.log(event.stream.id);
    
    remoteList[socketId] = event.stream.id;
    container.setState({ remoteList: remoteList });
  };
  pc.onremovestream = function (event) {
    //console.log("onremovestream", event.stream);
  };
  
  pc.addStream(localStream);
  
  function createDataChannel() {
    if (pc.textDataChannel) {
      return;
    }
    const dataChannel = pc.createDataChannel("text");
    
    dataChannel.onerror = function (error) {
      //console.log("dataChannel.onerror", error);
    };
    
    dataChannel.onmessage = function (event) {
      //console.log("dataChannel.onmessage:", event.data);
      container.receiveTextData({ user: socketId, message: event.data });
    };
    
    dataChannel.onopen = function () {
      //console.log("dataChannel.onopen");
      container.setState({ textRoomConnected: true });
    };
    
    dataChannel.onclose = function () {
      //console.log("dataChannel.onclose");
    };
    
    pc.textDataChannel = dataChannel;
  }
  
  return pc;
}

function exchange(data) {
  const fromId = data.from;
  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }
  
  if (data.sdp) {
    //console.log("exchange sdp", data);
    pc.setRemoteDescription(
      new RTCSessionDescription(data.sdp),
      function () {
        if (pc.remoteDescription.type === "offer") {
          pc.createAnswer(function (desc) {
            //console.log("createAnswer", desc);
            pc.setLocalDescription(
              desc,
              function () {
                //console.log("setLocalDescription", pc.localDescription);
                socket.emit("exchange", {
                  to: fromId,
                  sdp: pc.localDescription,
                });
              },
              logError,
            );
          }, logError);
        }
      },
      logError,
    );
  } else {
    //console.log("exchange candidate", data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}

function leave(socketId) {
  //console.log("leave", socketId);
  const pc = pcPeers[socketId];
  const viewIndex = pc.viewIndex;
  pc.close();
  delete pcPeers[socketId];
  
  const remoteList = container.state.remoteList;
  delete remoteList[socketId];
  container.setState({ remoteList: remoteList });
  container.setState({ info: "One peer leave!" });
}

socket.on("exchange", function (data) {
  exchange(data);
});
socket.on("leave", function (socketId) {
  leave(socketId);
});
socket.on("connect", function (data) {
  //console.log("connect");
});

function logError(error) {
  console.log("logError", error);
}

function mapHash(hash, func) {
  const array = [];
  for (const key in hash) {
    const obj = hash[key];
    array.push(func(obj, key));
  }
  return array;
}

function getStats() {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  if (pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    
    //console.log("track", track);
    
    pc.getStats(
      track,
      function (report) {
        //console.log("getStats report", report);
      },
      logError,
    );
  }
}

export default class App extends Component {
  state = {
    stream: "",
    isFront: true,
    videoSourceId: null,
    mirror: false,
    objectFit: 'contain',
    
    roomID: "abc",
    status: "init",
    remoteList: {},
  };
  
  async componentDidMount() {
    container = this;
    await this.initStream();
  }
  
  initStream = async () => {
    try {
      // Get all devices (video/audio) in array list
      const sourceInfos = await mediaDevices.enumerateDevices();
      console.log(sourceInfos);
      
      // Iterate the list above and find the front camera
      await Promise.all(sourceInfos.map(async sourceInfo => {
        console.log(sourceInfo);
        
        if (sourceInfo.kind === 'videoinput' && sourceInfo.label === 'Camera 1, Facing front, Orientation 270') {
          this.setState({ videoSourceId: sourceInfo.deviceId });
        }
      }));
      
      // Get the stream of front camera
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: (this.state.isFront ? 'user' : 'environment'),
          optional: [{ sourceId: this.state.videoSourceId }],
        },
      });
      
      localStream = stream;
      
      this.setState({
        stream,
        status: 'ready',
      });
      console.log(stream);
    } catch (error) {console.log(error);}
  };
  
  switchCamera = async () => {
    const { stream } = this.state;
    stream.getVideoTracks().forEach(track => {
      track._switchCamera();
    });
    
    /*this.setState({ isFront: !this.state.isFront });
     await this.initStream();*/
  };
  
  objectFit = () => {
    if (this.state.objectFit === 'contain') {
      this.setState({ objectFit: 'cover' });
    }
    if (this.state.objectFit === 'cover') {
      this.setState({ objectFit: 'contain' });
    }
  };
  
  button = (func, text) => (
    <TouchableOpacity style={s.button} onPress={func}>
      <Text style={s.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
  
  _press = () => {
    // console.log("roomID", this.refs.roomID);
    // this.refs.roomID.blur();
    //console.log("press", this.state.roomID);
    
    this.setState({ status: "connect", info: "Connecting" });
    join(this.state.roomID);
  };
  
  render() {
    const { stream, mirror, objectFit } = this.state;
    
    return (
      <View style={s.container}>
        <RTCView
          style={s.rtcView}
          streamURL={stream.id}
          mirror={mirror}
          objectFit={objectFit}
        />
        
        {
          this.state.status === "ready"
            ?
            (<View>
              <TextInput
                // ref="roomID"
                autoCorrect={false}
                style={{
                  width: 200,
                  height: 40,
                  borderColor: "gray",
                  borderWidth: 1,
                }}
                onChangeText={text => this.setState({ roomID: text })}
                value={this.state.roomID}
              />
              <TouchableOpacity onPress={this._press}>
                <Text>Enter room</Text>
              </TouchableOpacity>
            </View>)
            :
            null
        }
        
        {
          mapHash(this.state.remoteList, function (remote, index) {
            return (
              <RTCView key={index} streamURL={remote.id} style={s.rtcView}/>
            );
          })
        }
        
        {this.button(this.switchCamera, 'Change Camera')}
        {this.button(() => this.setState({ mirror: !mirror }), 'Mirror')}
        {this.button(this.objectFit, 'Object Fit (contain/cover)')}
      </View>
    );
  }
}