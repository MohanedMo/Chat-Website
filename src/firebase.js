import { initializeApp } from "firebase/app";
import {GoogleAuthProvider, getAuth, signInWithPopup} from "firebase/auth"
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDIiF3ry1XITrhlWcB0eJZnAezuGjPIfCg",
  authDomain: "react-chat-4fd48.firebaseapp.com",
  projectId: "react-chat-4fd48",
  storageBucket: "react-chat-4fd48.appspot.com",
  messagingSenderId: "1044305419447",
  appId: "1:1044305419447:web:5f7b11ba796bc74861c132"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)

const provider = new GoogleAuthProvider()

export const signInWithGoogle = () =>{
  signInWithPopup(auth,provider).then((result)=> {
    console.log(result)
  }).catch((err)=>{
    console.log(err)
  })
}

export const db = getFirestore(app)