import React, { Component }       from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
}                                 from 'react-native-webrtc';


const configuration = { "iceServers": [{ "url": "stun:stun.l.google.com:19302" }] };
const pc = new RTCPeerConnection(configuration);

let isFront = true;
mediaDevices.enumerateDevices().then(sourceInfos => {
  console.log(sourceInfos);
  let videoSourceId;
  for (let i = 0; i < sourceInfos.length; i++) {
    const sourceInfo = sourceInfos[i];
    if (sourceInfo.kind === "video" && sourceInfo.facing === (isFront ? "front" : "back")) {
      videoSourceId = sourceInfo.id;
    }
  }
  mediaDevices.getUserMedia({
    audio: true,
    video: {
      mandatory: {
        minWidth: 500, // Provide your own width, height and frame rate here
        minHeight: 300,
        minFrameRate: 30,
      },
      facingMode: (isFront ? "user" : "environment"),
      optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
    },
  })
    .then(stream => {
      this.setState({ stream });
    })
    .catch(error => {
      // Log error
    });
});

pc.createOffer().then(desc => {
  pc.setLocalDescription(desc).then(() => {
    // Send pc.localDescription to peer
  });
});

pc.onicecandidate = function (event) {
  // send event.candidate to peer
};

let localStream;
let container;

async function initStream() {
  mediaDevices.enumerateDevices().then(sourceInfos => {
    console.log(sourceInfos);
    let videoSourceId;
    for (let i = 0; i < sourceInfos.length; i++) {
      const sourceInfo = sourceInfos[i];
      if (sourceInfo.kind === "video" && sourceInfo.facing === (isFront ? "front" : "back")) {
        videoSourceId = sourceInfo.id;
      }
    }
    mediaDevices.getUserMedia({
      audio: true,
      video: {
        mandatory: {
          minWidth: 500, // Provide your own width, height and frame rate here
          minHeight: 300,
          minFrameRate: 30,
        },
        facingMode: (isFront ? "user" : "environment"),
        optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
      },
    })
      .then(stream => {
        this.setState({ stream });
      })
      .catch(error => {
        // Log error
      });
  });
}

async function getLocalStream(isFront, callback) {
  let videoSourceId;
  
  try {
    let stream = await mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          minWidth: 640, // Provide your own width, height and frame rate here
          minHeight: 360,
          minFrameRate: 30,
        },
        facingMode: isFront ? "user" : "environment",
        optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
      },
    });
    await callback(stream);
  } catch (e) {
    console.log("logError", e);
  }
}

export default class App extends Component {
  state = {
    stream: null,
  };
  
  async componentDidMount() {
    await initStream();
  }
  
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Welcome to React Native!</Text>
        
        <RTCView streamURL={this.state.stream.toURL()} style={styles.selfView}/>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  selfView: {
    width: 200,
    height: 150,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#F5FCFF",
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});
