import React from 'react'
const MainPage: React.FC = () => {
    return (
        <div style={styles.container}>
            <h1 style={styles.heading}>Добро пожаловать</h1>
        </div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#78c4e4ff',
  },
  dict: {
    color: 'blue',
    backgroundColor: '#78c4e4ff',
  },
  heading: {
    fontSize: '2.5rem',
    color: '#333',
    fontFamily: 'sans-serif',
  },
};

export default MainPage;