import React, { Component } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  YellowBox,
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

const url = 'https://42471ad5.ngrok.io';
const socket = io.connect(url, { transports: ["websocket"] });
const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let pcPeers = {};
let container;
let localStream;

const join = roomID => {
  let state = 'join';
  let callback = socketIds => {
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        createPC(socketId, true);
      }
    }
  };
  
  socket.emit(state, roomID, callback);
};

const createPC = (socketId, isOffer) => {
  const peer = new RTCPeerConnection(configuration);
  
  pcPeers = {
    ...pcPeers,
    [socketId]: peer,
  };
  
  peer.addStream(localStream);
  
  peer.onicecandidate = event => {
    //console.log("onicecandidate", event.candidate);
    if (event.candidate) {
      socket.emit("exchange", { to: socketId, candidate: event.candidate });
    }
  };
  
  peer.onnegotiationneeded = () => {
    //console.log("onnegotiationneeded");
    if (isOffer) {
      createOffer();
    }
  };
  
  peer.oniceconnectionstatechange = event => {
    //console.log("oniceconnectionstatechange", event.target.iceConnectionState);
    if (event.target.iceConnectionState === "completed") {
      console.log('event.target.iceConnectionState === "completed"');
      setTimeout(() => {
        getStats();
      }, 1000);
    }
    if (event.target.iceConnectionState === "connected") {
      console.log('event.target.iceConnectionState === "connected"');
    }
  };
  peer.onsignalingstatechange = event => {
    console.log("on signaling state change", event.target.signalingState);
  };
  
  peer.onaddstream = event => {
    //console.log("onaddstream", event.stream);
    const remoteList = container.state.remoteList;
    
    remoteList[socketId] = event.stream.id;
    container.setState({
      info: "One peer join!",
      remoteList: remoteList,
    });
  };
  peer.onremovestream = event => {
    console.log("on remove stream", event.stream);
  };
  
  const createOffer = () => {
    let callback = desc => {
      console.log("createOffer", desc);
      peer.setLocalDescription(desc, callback2, logError);
    };
    let callback2 = () => {
      console.log("setLocalDescription", peer.localDescription);
      socket.emit("exchange", { to: socketId, sdp: peer.localDescription });
    };
    
    peer.createOffer(callback, logError);
  };
  
  return peer;
};

socket.on("connect", () => {
  console.log("connect");
});
socket.on("leave", socketId => {
  leave(socketId);
});
socket.on("exchange", data => {
  exchange(data);
});

const exchange = data => {
  const fromId = data.from;
  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }
  
  if (data.sdp) {
    //console.log("exchange sdp", data);
    let sdp = new RTCSessionDescription(data.sdp);
    
    let callback = () => pc.remoteDescription.type === "offer" ? pc.createAnswer(callback2, logError) : null;
    let callback2 = desc => pc.setLocalDescription(desc, callback3, logError);
    let callback3 = () => socket.emit("exchange", { to: fromId, sdp: pc.localDescription });
    
    pc.setRemoteDescription(sdp, callback, logError);
  } else {
    //console.log("exchange candidate", data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};

const leave = socketId => {
  console.log("leave", socketId);
  
  const peer = pcPeers[socketId];
  
  peer.close();
  
  delete pcPeers[socketId];
  
  const remoteList = container.state.remoteList;
  
  delete remoteList[socketId];
  
  container.setState({
    info: "One peer leave!",
    remoteList: remoteList,
  });
};

const logError = error => {
  console.log("logError", error);
  console.trace();
};

const mapHash = (hash, func) => {
  
  /*console.log("YOOOOOOOOO");
  console.log(hash);
  let x = Object.keys(hash)[0];
  let xx = '';
  
  if (x !== undefined) {
    console.log(x);
    console.log(hash);
    console.log(hash[x]);
    
    for (let i = 0; i <= hash[x].length - 1; i++) {
      if (hash[x][i] !== '{' && hash[x][i] !== '}') {
        xx += hash[x][i];
        console.log(xx);
      }
    }
  }*/
  
  const array = [];
  for (const key in hash) {
    if (hash.hasOwnProperty(key)) {
      const obj = hash[key];
      array.push(func(obj, key));
    }
  }
  return array;
};

const getStats = () => {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  
  if (pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    
    //console.log("track", track);
    
    let callback = report => console.log("getStats report", report);
    
    pc.getStats(track, callback, logError);
  }
};

export default class App extends Component {
  state = {
    localStream: "",
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
      //console.log(sourceInfos);
      
      // Iterate the list above and find the front camera
      await Promise.all(sourceInfos.map(async sourceInfo => {
        //console.log(sourceInfo);
        
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
        localStream: stream,
        status: 'ready',
      });
      //console.log(stream);
    } catch (error) {console.log(error);}
  };
  
  switchCamera = async () => {
    const { localStream } = this.state;
    localStream.getVideoTracks().forEach(track => {
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
  
  join = () => {
    this.setState({
      status: "connect",
      info: "Connecting",
    });
    
    join(this.state.roomID);
  };
  
  render() {
    const { localStream, mirror, objectFit, status, remoteList } = this.state;
    
    return (
      <View style={s.container}>
        <RTCView
          style={s.rtcView}
          streamURL={localStream.id}
          mirror={mirror}
          objectFit={objectFit}
        />
        
        {
          mapHash(remoteList, (remote, index) => {
            return (<RTCView key={index} streamURL={remote} style={s.rtcView}/>);
          })
        }
        {this.button(this.switchCamera, 'Change Camera')}
        {this.button(() => this.setState({ mirror: !mirror }), 'Mirror')}
        {this.button(this.objectFit, 'Object Fit (contain/cover)')}
        
        {status === "ready" ? this.button(this.join, 'Enter room') : null}
      </View>
    );
  }
}
